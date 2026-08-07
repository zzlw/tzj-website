import type { SitePublicSettings } from '@tzj/types';
import { env } from './env';
import { getS3PublicDomain } from './media-url';
import { siteConfig } from './site';
import { DEFAULT_SITE_PUBLIC_SETTINGS } from './site-defaults';

const API_BASE = env.apiUrl;

/** TTL 元数据缓存（固定 60s）：后台改 TTL 后最长 60s 内新值生效 */
const CACHE_TTL_META_REVALIDATE = 60;

/** 与 api 端 DEFAULT_CACHE_TTL_SECONDS 对齐的兜底值（无配置/请求失败时） */
const DEFAULT_CACHE_TTL_SECONDS = 300;

/**
 * 读取后台配置的官网设置缓存 TTL（秒）。
 * 两级缓存：TTL 元数据固定 60s 缓存（后台改 TTL 最长 1 分钟生效），
 * 站点设置内容按返回的 TTL 缓存（docs/site-settings-cache-ttl-design.md §3.2）。
 */
async function getCacheTtl(): Promise<number> {
  try {
    const res = await fetch(`${API_BASE}/settings/cache-ttl`, {
      next: { revalidate: CACHE_TTL_META_REVALIDATE },
    });
    if (!res.ok) throw new Error(`cache-ttl ${res.status}`);
    const json = (await res.json()) as { data?: { ttl?: number } };
    const ttl = json.data?.ttl;
    return typeof ttl === 'number' && ttl >= 0 ? Math.floor(ttl) : DEFAULT_CACHE_TTL_SECONDS;
  } catch {
    return DEFAULT_CACHE_TTL_SECONDS;
  }
}

/** 合并 CMS 设置与环境变量 / 静态默认值（env 优先于 CMS 用于部署级覆盖） */
export function mergeSiteSettings(cms: SitePublicSettings): SitePublicSettings {
  return {
    contact: {
      phone: process.env.NEXT_PUBLIC_CONTACT_PHONE || cms.contact.phone,
      phoneAlt: cms.contact.phoneAlt,
      primaryPhone: cms.contact.primaryPhone,
      email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || cms.contact.email,
      address: {
        ...cms.contact.address,
        ...(process.env.NEXT_PUBLIC_CONTACT_ADDRESS
          ? { 'zh-CN': process.env.NEXT_PUBLIC_CONTACT_ADDRESS }
          : {}),
      },
    },
    legal: {
      beian: process.env.NEXT_PUBLIC_BEIAN || cms.legal.beian,
      beianUrl: cms.legal.beianUrl,
      gonganBeian: cms.legal.gonganBeian,
      gonganBeianUrl: cms.legal.gonganBeianUrl,
    },
    social: cms.social,
    analytics: {
      geoMode: cms.analytics?.geoMode ?? DEFAULT_SITE_PUBLIC_SETTINGS.analytics.geoMode,
      ipGeoSource: cms.analytics?.ipGeoSource ?? DEFAULT_SITE_PUBLIC_SETTINGS.analytics.ipGeoSource,
      // 后台配置优先，环境变量作兜底：上线后可随时在后台换号/停用
      baiduHmId: cms.analytics?.baiduHmId || env.baiduHmId,
    },
    businessHours: cms.businessHours ?? DEFAULT_SITE_PUBLIC_SETTINGS.businessHours,
    agentProfile: {
      ...DEFAULT_SITE_PUBLIC_SETTINGS.agentProfile,
      ...cms.agentProfile,
    },
    chatPrompts: {
      ...DEFAULT_SITE_PUBLIC_SETTINGS.chatPrompts,
      ...cms.chatPrompts,
    },
    screenWatermark: {
      ...DEFAULT_SITE_PUBLIC_SETTINGS.screenWatermark,
      ...cms.screenWatermark,
    },
  };
}

/** 从 API 拉取官网站点设置（Data Cache 策略：TTL 由后台「官网生效速度」配置）
 * - 默认 300s（5 分钟）；后台可配 0-86400s，0 = 不缓存每次实时读取
 * - dev 下 Next 整体禁用 Data Cache，TTL 与 0 等价，无需分支（docs/site-settings-cache-ttl-design.md §3.2）
 */
export async function getSitePublicSettings(): Promise<SitePublicSettings> {
  try {
    const ttl = await getCacheTtl();
    const res = await fetch(`${API_BASE}/settings/site/public`, {
      next: { revalidate: ttl, tags: ['site-settings'] },
    });
    if (!res.ok) throw new Error(`settings ${res.status}`);
    const json = (await res.json()) as { data?: SitePublicSettings };
    const cms = json.data ?? DEFAULT_SITE_PUBLIC_SETTINGS;
    return mergeSiteSettings(cms);
  } catch {
    return mergeSiteSettings({
      ...DEFAULT_SITE_PUBLIC_SETTINGS,
      contact: {
        ...DEFAULT_SITE_PUBLIC_SETTINGS.contact,
        phone: siteConfig.contact.phone,
        email: siteConfig.contact.email,
        address: DEFAULT_SITE_PUBLIC_SETTINGS.contact.address,
      },
      legal: {
        ...DEFAULT_SITE_PUBLIC_SETTINGS.legal,
        beian: siteConfig.beian,
      },
    });
  }
}

export function localizedAddress(
  settings: SitePublicSettings,
  locale: string,
  fallback: string,
): string {
  const map = settings.contact.address;
  return map[locale as keyof typeof map] ?? map['zh-CN'] ?? map.en ?? fallback;
}

/**
 * 解析联系电话的主/备划分（后台可配置 primaryPhone）。
 * - primary：主电话，用于「点击咨询」分流（无坐席在线时兜底拨号）与结构化数据
 * - secondary：备用电话（选填，留空则不展示）
 * 展示顺序固定为主电话在前。primaryPhone 指向空号码时自动回退到 phone。
 */
export function resolveContactPhones(settings: SitePublicSettings): {
  primary: string;
  secondary?: string;
} {
  const { phone, phoneAlt, primaryPhone } = settings.contact;
  const alt = phoneAlt?.trim() || undefined;
  if (primaryPhone === 'phoneAlt' && alt) {
    return { primary: alt, secondary: phone };
  }
  return { primary: phone, secondary: alt };
}

/**
 * 获取网站 favicon URL（Data Cache 策略同上：TTL 由后台「官网生效速度」配置）。
 * 优先从 API 查询，回退到 S3 静态路径。
 */
export async function getFaviconUrl(): Promise<string | null> {
  try {
    const ttl = await getCacheTtl();
    const res = await fetch(`${API_BASE}/site-settings/favicon`, {
      next: { revalidate: ttl, tags: ['site-settings'] },
    });
    if (!res.ok) throw new Error(`favicon ${res.status}`);
    const json = (await res.json()) as { data?: { url: string | null } };
    return json.data?.url ?? null;
  } catch {
    // 回退：直接构造 S3 静态路径（文件不存在时浏览器静默 404）
    return `${getS3PublicDomain().replace(/\/$/, '')}/statics/favicon.ico`;
  }
}
