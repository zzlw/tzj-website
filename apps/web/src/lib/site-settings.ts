import type { SitePublicSettings } from "@tzj/types";
import { siteConfig } from "./site";
import { DEFAULT_SITE_PUBLIC_SETTINGS } from "./site-defaults";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

/** 合并 CMS 设置与环境变量 / 静态默认值（env 优先于 CMS 用于部署级覆盖） */
export function mergeSiteSettings(cms: SitePublicSettings): SitePublicSettings {
  return {
    contact: {
      phone: process.env.NEXT_PUBLIC_CONTACT_PHONE || cms.contact.phone,
      email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || cms.contact.email,
      address: {
        ...cms.contact.address,
        ...(process.env.NEXT_PUBLIC_CONTACT_ADDRESS
          ? { "zh-CN": process.env.NEXT_PUBLIC_CONTACT_ADDRESS }
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
    },
  };
}

/** 从 API 拉取官网站点设置（ISR 5 分钟，失败回退默认值） */
export async function getSitePublicSettings(): Promise<SitePublicSettings> {
  try {
    const res = await fetch(`${API_BASE}/settings/site/public`, {
      next: { revalidate: 300, tags: ["site-settings"] },
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
  return (
    map[locale as keyof typeof map] ??
    map["zh-CN"] ??
    map.en ??
    fallback
  );
}
