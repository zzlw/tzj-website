import type { SitePublicSettings } from '@tzj/types';
import { env } from './env';
import { getS3PublicDomain } from './media-url';
import { siteConfig } from './site';
import { DEFAULT_SITE_PUBLIC_SETTINGS } from './site-defaults';

const API_BASE = env.apiUrl;

/** 合并 CMS 设置与环境变量 / 静态默认值（env 优先于 CMS 用于部署级覆盖） */
export function mergeSiteSettings(cms: SitePublicSettings): SitePublicSettings {
  return {
    contact: {
      phone: process.env.NEXT_PUBLIC_CONTACT_PHONE || cms.contact.phone,
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
    },
    social: cms.social,
    analytics: {
      geoMode: cms.analytics?.geoMode ?? DEFAULT_SITE_PUBLIC_SETTINGS.analytics.geoMode,
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

/** 从 API 拉取官网站点设置（ISR 缓存策略）
 * - 生产环境：300 秒（5 分钟），平衡性能与时效性
 * - 开发环境：0 秒，即时生效便于调试
 */
export async function getSitePublicSettings(): Promise<SitePublicSettings> {
  const isDev = process.env.NODE_ENV === 'development';
  const revalidateTime = isDev ? 0 : 300; // 开发环境不缓存，生产环境 5 分钟

  try {
    const res = await fetch(`${API_BASE}/settings/site/public`, {
      next: { revalidate: revalidateTime, tags: ['site-settings'] },
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
 * 获取网站 favicon URL（ISR 缓存策略）。
 * - 生产环境：300 秒（5 分钟）
 * - 开发环境：0 秒，即时生效
 * 优先从 API 查询，回退到 S3 静态路径。
 */
export async function getFaviconUrl(): Promise<string | null> {
  const isDev = process.env.NODE_ENV === 'development';
  const revalidateTime = isDev ? 0 : 300;

  try {
    const res = await fetch(`${API_BASE}/site-settings/favicon`, {
      next: { revalidate: revalidateTime, tags: ['site-settings'] },
    });
    if (!res.ok) throw new Error(`favicon ${res.status}`);
    const json = (await res.json()) as { data?: { url: string | null } };
    return json.data?.url ?? null;
  } catch {
    // 回退：直接构造 S3 静态路径（文件不存在时浏览器静默 404）
    return `${getS3PublicDomain().replace(/\/$/, '')}/statics/favicon.ico`;
  }
}
