import { Injectable, Logger } from '@nestjs/common';
import type { AnalyticsIpGeoSource } from '@tzj/types';
import * as ip2region from 'ip2region-ts';
import { IntegrationsService } from '../integrations/integrations.service';

/**
 * IP 归属地解析结果。location 为人类可读的完整地址，前端直接展示。
 */
export interface IpLocation {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  isp: string;
  /** 拼接好的最精确地址，如「江苏省 南京市」 */
  location: string;
}

/** 高德 /v3/ip 响应（仅取用字段） */
interface AmapIpResponse {
  status?: string;
  info?: string;
  province?: string;
  city?: string;
}

/** BigDataCloud /data/ip-geolocation 响应（免费客户端端点，无需 Key） */
interface BigDataCloudIpResponse {
  countryName?: string;
  countryCode?: string;
  principalSubdivision?: string;
  city?: string;
  locality?: string;
}

/** 高德接入配置（Key + 开关，短 TTL 缓存） */
interface AmapConfig {
  enabled: boolean;
  key: string;
}

/**
 * IP 地理位置解析服务（数据源由站点设置「IP 定位数据源」手动选择）：
 * - offline（默认）：ip2region 内置离线库，国内省/市 + 运营商，不外呼
 * - bigdata：BigDataCloud 免费 IP 归属地（无需 Key，海外可用）
 * - amap：高德 IP 定位（Key 在「集成与凭证 → 高德地图」配置，DB 加密优先、AMAP_WEB_KEY env 兜底）
 * - 结果按原始 IP 缓存 7 天；未命中短 TTL 30 分钟；同 IP 并发合并为单次外呼
 */
@Injectable()
export class IpLocationService {
  private readonly logger = new Logger(IpLocationService.name);
  /** 解析结果缓存 7 天：同一 IP 归属地短期稳定，大幅降低外呼次数 */
  private readonly cacheTtlMs = 7 * 24 * 60 * 60 * 1000;
  /** 未命中用短 TTL（30 分钟），避免对坏 IP 反复外呼 */
  private readonly missTtlMs = 30 * 60 * 1000;
  /** 单次外呼超时，避免上游抖动拖慢请求 */
  private readonly timeoutMs = 3000;
  private readonly cache = new Map<string, { value: IpLocation | null; exp: number }>();
  /** 同 IP 并发去重（如整页批量解析 + 采集写入同时发生） */
  private readonly inflight = new Map<string, Promise<IpLocation | null>>();
  /** 高德接入配置缓存（后台可改，短 TTL 避免每次解析都查库） */
  private amapConfigCache?: { value: AmapConfig; exp: number };
  private readonly amapConfigTtlMs = 60 * 1000;
  /** ip2region 离线 searcher（xdb 全量载入内存，查询为本地操作） */
  private readonly ip2regionSearcher: ReturnType<typeof ip2region.newWithBuffer> | null =
    this.initIp2Region();

  constructor(private readonly integrations: IntegrationsService) {}

  /** 解析单个 IP，命中缓存优先；内网/无效返回 null。 */
  async resolve(
    ip?: string | null,
    source: AnalyticsIpGeoSource = 'offline',
  ): Promise<IpLocation | null> {
    const normalized = this.normalizeIp(ip);
    if (!normalized || this.isPrivateIp(normalized)) return null;

    const cacheKey = `${source}:${normalized}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.exp > Date.now()) return cached.value;

    const inflight = this.inflight.get(cacheKey);
    if (inflight) return inflight;

    const task = this.resolveUncached(normalized, source).finally(() => {
      this.inflight.delete(cacheKey);
    });
    this.inflight.set(cacheKey, task);
    return task;
  }

  /** 批量解析（并行，供列表读取路径一次解析整页 IP）。 */
  async resolveMany(
    ips: Array<string | null | undefined>,
    source: AnalyticsIpGeoSource = 'offline',
  ): Promise<Map<string, IpLocation | null>> {
    const unique = Array.from(
      new Set(ips.map((ip) => this.normalizeIp(ip)).filter((ip): ip is string => Boolean(ip))),
    );
    const entries = await Promise.all(
      unique.map(async (ip) => [ip, await this.resolve(ip, source)] as const),
    );
    return new Map(entries);
  }

  private async resolveUncached(
    ip: string,
    source: AnalyticsIpGeoSource,
  ): Promise<IpLocation | null> {
    let location: IpLocation | null = null;
    if (source === 'offline') {
      location = await this.searchIp2Region(ip);
    } else if (source === 'bigdata') {
      location = await this.queryByBigDataCloud(ip);
    } else if (source === 'amap') {
      const config = await this.getAmapConfig();
      if (config.enabled) {
        location = await this.queryByAmap(ip, config.key);
      }
    }

    this.cache.set(`${source}:${ip}`, {
      value: location,
      exp: Date.now() + (location ? this.cacheTtlMs : this.missTtlMs),
    });
    return location;
  }

  /** ip2region 离线查询：仅采用国内命中（省/市 + 运营商），国外交给 BigDataCloud 获取结构化国家码 */
  private async searchIp2Region(ip: string): Promise<IpLocation | null> {
    const searcher = this.ip2regionSearcher;
    if (!searcher) return null;
    try {
      const hit = await searcher.search(ip);
      const parts = (hit?.region ?? '').split('|').map((part) => this.cleanIp2Field(part));
      const [country = '', , rawRegion = '', rawCity = '', isp = ''] = parts;
      if (country !== '中国' || (!rawRegion && !rawCity)) return null;

      // 直辖市会出现「北京|北京市」重复层级，保留更详尽者作为省
      let region = rawRegion;
      let city = rawCity;
      if (city && region && city.includes(region)) {
        region = city;
        city = '';
      }

      return {
        country: '中国',
        countryCode: 'CN',
        region,
        city,
        isp,
        location: this.joinPlace(region, city) || '未知',
      };
    } catch {
      return null;
    }
  }

  /** ip2region 字段清洗：0 / 空串视为缺失 */
  private cleanIp2Field(value: string): string {
    const v = value.trim();
    return v && v !== '0' ? v : '';
  }

  /** 载入内置 xdb（随包附带）；失败仅警告并降级到在线链路 */
  private initIp2Region(): ReturnType<typeof ip2region.newWithBuffer> | null {
    try {
      return ip2region.newWithBuffer(ip2region.loadContentFromFile(ip2region.defaultDbFile));
    } catch (error) {
      this.logger.warn(`ip2region 离线库加载失败，跳过离线定位：${(error as Error).message}`);
      return null;
    }
  }

  /** 高德 IP 定位（/v3/ip）：仅支持国内 IPv4，国外/无法归属时返回空字段视为未命中 */
  private async queryByAmap(ip: string, key: string): Promise<IpLocation | null> {
    const url = new URL('https://restapi.amap.com/v3/ip');
    url.searchParams.set('key', key);
    url.searchParams.set('ip', ip);
    url.searchParams.set('output', 'JSON');

    try {
      const data = (await this.fetchJson(url.toString())) as AmapIpResponse;
      if (data?.status !== '1') return null;
      const province = this.cleanAmapField(data.province);
      const city = this.cleanAmapField(data.city);
      if (!province && !city) return null;
      return {
        country: '中国',
        countryCode: 'CN',
        region: province,
        city,
        isp: '',
        location: this.joinPlace(province, city) || '未知',
      };
    } catch {
      return null;
    }
  }

  /** 高德空字段可能是空串或 []，统一清洗 */
  private cleanAmapField(value?: string): string {
    const v = (value ?? '').trim();
    return v && v !== '[]' ? v : '';
  }

  /** BigDataCloud IP 归属地（免费、无需 Key，海外可用）；失败返回 null */
  private async queryByBigDataCloud(ip: string): Promise<IpLocation | null> {
    const url = new URL('https://api.bigdatacloud.net/data/ip-geolocation');
    url.searchParams.set('ip', ip);
    url.searchParams.set('localityLanguage', 'zh');

    try {
      const data = (await this.fetchJson(url.toString())) as BigDataCloudIpResponse;
      const countryCode = (data.countryCode ?? '').trim().toUpperCase();
      const region = (data.principalSubdivision ?? '').trim();
      const city = (data.city ?? data.locality ?? '').trim();
      if (!countryCode && !region && !city) return null;

      const regionCity = this.joinPlace(region, city);
      // 国内与高德口径一致（不带「中国」前缀），海外保留国家名
      const countryLabel = countryCode === 'CN' ? '' : data.countryName?.trim() || countryCode;
      return {
        country: data.countryName?.trim() || countryCode,
        countryCode,
        region,
        city,
        isp: '',
        location: [countryLabel, regionCity].filter(Boolean).join(' ') || '未知',
      };
    } catch {
      return null;
    }
  }

  /** 拼接地理串并去重相邻重复（直辖市的省=市时只保留一个） */
  private joinPlace(province: string, city: string): string {
    const parts: string[] = [];
    for (const part of [province, city]) {
      if (!part) continue;
      const prev = parts[parts.length - 1];
      if (prev && (prev.includes(part) || part.includes(prev))) {
        if (part.length > prev.length) parts[parts.length - 1] = part;
        continue;
      }
      parts.push(part);
    }
    return parts.join(' ');
  }

  /** 读取后台配置：Key 沿用「高德地图」集成（DB 加密优先，AMAP_WEB_KEY env 兜底） */
  private async getAmapConfig(): Promise<AmapConfig> {
    const now = Date.now();
    if (this.amapConfigCache && this.amapConfigCache.exp > now) {
      return this.amapConfigCache.value;
    }

    const active = await this.integrations.isActive('amap');
    const rawKey = active ? await this.integrations.resolveSecret('amap', 'webKey') : null;
    const key = rawKey?.trim() ?? '';
    const config: AmapConfig = {
      enabled: Boolean(key),
      key,
    };
    this.amapConfigCache = { value: config, exp: now + this.amapConfigTtlMs };
    return config;
  }

  private async fetchJson(url: string): Promise<Record<string, unknown>> {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: { 'User-Agent': 'tzj-analytics/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as Record<string, unknown>;
  }

  /** 去掉 IPv4-mapped IPv6 前缀并规整 */
  private normalizeIp(ip?: string | null): string {
    return (ip ?? '')
      .replace(/^::ffff:/i, '')
      .trim()
      .toLowerCase();
  }

  /** 内网 / 回环 / 保留地址判定：这些 IP 外呼无意义 */
  private isPrivateIp(ip: string): boolean {
    const value = ip.trim().toLowerCase();
    if (!value || value === 'unknown' || value === 'localhost') return true;
    if (
      value === '::1' ||
      value.startsWith('fe80') ||
      value.startsWith('fc') ||
      value.startsWith('fd')
    ) {
      return true;
    }
    const v4 = value.includes('.') ? (value.split(':').pop() ?? value) : value;
    if (/^127\./.test(v4) || /^10\./.test(v4) || /^192\.168\./.test(v4)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(v4)) return true;
    if (/^169\.254\./.test(v4)) return true;
    return false;
  }
}
