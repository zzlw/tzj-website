import { Injectable, Logger } from '@nestjs/common';
import libQQWry from 'lib-qqwry';

/**
 * IP 归属地解析结果（尽可能精确）。location 为人类可读的完整地址，前端直接展示。
 */
export interface IpLocation {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  isp: string;
  /** 拼接好的最精确地址，如「江苏省南京市玄武区」「美国加利福尼亚州圣克拉拉县山景市」 */
  location: string;
}

/** 单一上游归一化结果（place 为不含运营商的纯地理串） */
interface ProviderResult {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  isp: string;
  place: string;
}

/** ip-api.com 响应（仅取用字段） */
interface IpApiResponse {
  status?: string;
  message?: string;
  country?: string;
  countryCode?: string;
  regionName?: string;
  city?: string;
}

/** ipapi.co 响应（仅取用字段） */
interface IpapiCoResponse {
  error?: boolean;
  reason?: string;
  country_name?: string;
  country_code?: string;
  region?: string;
  city?: string;
  org?: string;
}

/**
 * IP 地理位置解析服务（参考 REDACTED-NAMESPACE-koa 的 IPLocationService，多源融合 + 缓存）。
 * - 主源：纯真 IP 库（qqwry，离线、随包内置 dat）。国内 IP 常到「省市区/街道 + 运营商」级，最精细
 * - 补充：ip-api.com（中文、带 ISO 国家码，用于国旗与国家维度聚合）+ ipapi.co 兜底
 * - 取两者中更详尽的地理串作为最终 location；结果按原始 IP 缓存
 * - 内网/保留地址直接跳过，不外呼
 *
 * 缓存实现说明：本项目 Redis 为可选依赖（仅多实例 Socket.IO/presence 用），
 * 故此处用进程内 TTL Map 缓存（与 utils/geo-reverse 的做法一致），无需强依赖 Redis。
 * 读取路径每页仅解析约 10 个 IP，命中缓存后重复读取近乎零成本。
 */
@Injectable()
export class IpLocationService {
  private readonly logger = new Logger(IpLocationService.name);
  /** 解析结果缓存 7 天：同一 IP 归属地短期稳定，大幅降低外呼次数 */
  private readonly cacheTtlMs = 7 * 24 * 60 * 60 * 1000;
  /** 未命中用短 TTL（30 分钟），避免对坏 IP 反复外呼 */
  private readonly missTtlMs = 30 * 60 * 1000;
  /** 单次外呼超时，避免上游抖动拖慢管理端读取 */
  private readonly timeoutMs = 3000;
  /** 纯真库实例（载入内存，查询为本地操作） */
  private readonly qqwry = this.initQqwry();
  private readonly cache = new Map<string, { value: IpLocation | null; exp: number }>();

  /** 解析单个 IP，命中缓存优先；内网/无效返回 null。 */
  async resolve(ip?: string | null): Promise<IpLocation | null> {
    const normalized = this.normalizeIp(ip);
    if (!normalized || this.isPrivateIp(normalized)) return null;

    const cached = this.cache.get(normalized);
    if (cached && cached.exp > Date.now()) return cached.value;

    // 纯真库本地查询（主源）；ip-api 在线补充国家码（兜底 ipapi.co）
    const qq = this.searchQqwry(normalized);
    const api =
      (await this.queryByIpApi(normalized).catch(() => null)) ??
      (await this.queryByIpapiCo(normalized).catch(() => null));

    const location = qq || api ? this.merge(qq, api) : null;

    this.cache.set(normalized, {
      value: location,
      exp: Date.now() + (location ? this.cacheTtlMs : this.missTtlMs),
    });
    return location;
  }

  /** 批量解析（并行，供列表读取路径一次解析整页 IP）。 */
  async resolveMany(
    ips: Array<string | null | undefined>,
  ): Promise<Map<string, IpLocation | null>> {
    const unique = Array.from(
      new Set(ips.map((ip) => this.normalizeIp(ip)).filter((ip): ip is string => Boolean(ip))),
    );
    const entries = await Promise.all(
      unique.map(async (ip) => [ip, await this.resolve(ip)] as const),
    );
    return new Map(entries);
  }

  /**
   * 融合纯真库与 ip-api，地理串取「更详尽者」：
   * - 纯真库住宅 IP 常到区县/街道；ip-api 对部分网关 IP 反而有区县级
   * - 两者都规范化后按行政层级（去空格字符数近似）取更细的一个
   * - isp 优先纯真库（中文「联通/电信」），国家码取 ip-api（用于国旗与国家维度聚合）
   */
  private merge(qq: { place: string; isp: string } | null, api: ProviderResult | null): IpLocation {
    const guessedCn = /中国|省|市|自治区|特别行政区/.test(qq?.place ?? '');
    const countryCode = api?.countryCode || (guessedCn ? 'CN' : '');
    // 国内去掉「中国」前缀，与纯真库格式一致并便于公平比较详尽度
    const apiPlace = this.stripCnPrefix(api?.place, countryCode);
    const place = this.pickRicher(qq?.place, apiPlace);
    const isp = qq?.isp || api?.isp || '';
    return {
      country: api?.country || (guessedCn ? '中国' : ''),
      countryCode,
      region: api?.region || '',
      city: api?.city || '',
      isp,
      location: place || '未知',
    };
  }

  /** 取行政层级更细（去空格后更长）的地理串 */
  private pickRicher(a?: string, b?: string): string {
    const x = (a ?? '').trim();
    const y = (b ?? '').trim();
    if (!x) return y;
    if (!y) return x;
    const len = (s: string) => s.replace(/\s/g, '').length;
    return len(x) >= len(y) ? x : y;
  }

  /** 国内地理串去掉「中国」前缀（国旗已表达国家，且与纯真库格式统一） */
  private stripCnPrefix(place: string | undefined, countryCode: string): string {
    const value = (place ?? '').trim();
    if (!value) return '';
    return countryCode === 'CN' || /^中国/.test(value) ? value.replace(/^中国\s*/, '') : value;
  }

  private initQqwry(): ReturnType<typeof libQQWry> | null {
    try {
      return libQQWry(true);
    } catch (error) {
      this.logger.warn(`纯真 IP 库加载失败，降级为在线解析：${(error as Error).message}`);
      return null;
    }
  }

  /** 纯真库查询：Country 为地理串，Area 为运营商/机房 */
  private searchQqwry(ip: string): { place: string; isp: string } | null {
    if (!this.qqwry) return null;
    try {
      const res = this.qqwry.searchIP(ip);
      const place = this.cleanQqwry(res?.Country);
      const isp = this.cleanQqwry(res?.Area);
      if (!place && !isp) return null;
      // 纯真库对未知 / 内网 IP 返回的占位文案，视为无效
      if (/未知|保留|IANA|内网|局域网|本机地址/.test(place)) return null;
      return { place, isp };
    } catch {
      return null;
    }
  }

  /** 清洗纯真库字段：去掉 CZ88.NET / 纯真网络 等占位与多余空白 */
  private cleanQqwry(value?: string): string {
    return (value ?? '')
      .replace(/CZ88\.?NET/gi, '')
      .replace(/纯真网络/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** ip-api.com：仅作补充，提供中文地名与 ISO 国家码（地理精度以纯真库为主） */
  private async queryByIpApi(ip: string): Promise<ProviderResult> {
    const fields = 'status,message,country,countryCode,regionName,city';
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?lang=zh-CN&fields=${fields}`;
    const data = (await this.fetchJson(url)) as IpApiResponse;
    if (data?.status !== 'success') throw new Error(data?.message || 'ip-api failed');
    return this.normalize({
      country: data.country,
      countryCode: data.countryCode,
      region: data.regionName,
      city: data.city,
      isp: '',
    });
  }

  /** ipapi.co：HTTPS 兜底 */
  private async queryByIpapiCo(ip: string): Promise<ProviderResult> {
    const data = (await this.fetchJson(
      `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
    )) as IpapiCoResponse;
    if (data?.error) throw new Error(data?.reason || 'ipapi.co failed');
    return this.normalize({
      country: data.country_name,
      countryCode: data.country_code,
      region: data.region,
      city: data.city,
      isp: data.org,
    });
  }

  private async fetchJson(url: string): Promise<Record<string, unknown>> {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: { 'User-Agent': 'tzj-analytics/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as Record<string, unknown>;
  }

  /** 统一字段、拼接地理串（去重相邻重复，如直辖市的省=市） */
  private normalize(raw: {
    country?: string;
    countryCode?: string;
    region?: string;
    city?: string;
    isp?: string;
  }): ProviderResult {
    const clean = (v?: string) => (v ?? '').trim();
    const parts: string[] = [];
    for (const part of [clean(raw.country), clean(raw.region), clean(raw.city)]) {
      if (!part) continue;
      const prev = parts[parts.length - 1];
      // 相邻层级一方包含另一方（如「北京市」与「北京」）时，只保留更详尽的
      if (prev && (prev.includes(part) || part.includes(prev))) {
        if (part.length > prev.length) parts[parts.length - 1] = part;
        continue;
      }
      parts.push(part);
    }
    return {
      country: clean(raw.country),
      countryCode: clean(raw.countryCode),
      region: clean(raw.region),
      city: clean(raw.city),
      isp: clean(raw.isp),
      place: parts.join(' '),
    };
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
