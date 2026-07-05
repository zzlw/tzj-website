import type { SitePublicSettings, SocialChannelSetting, SocialPlatformId } from "@tzj/types";

export const SITE_PUBLIC_SETTING_KEY = "site.public";

/** 微信默认客服，其余默认社媒关注 */
export function defaultChannelPurpose(platform: SocialPlatformId): "contact" | "follow" {
  return platform === "wechat" ? "contact" : "follow";
}

export function normalizeSocialChannel(channel: SocialChannelSetting): SocialChannelSetting {
  return {
    ...channel,
    purpose: channel.purpose ?? defaultChannelPurpose(channel.platform),
    qr: normalizeSocialQrPath(channel.qr),
  };
}

/** 将 MediaPicker URL 规范为 MinIO 对象 key，避免存 localhost 绝对地址 */
export function normalizeSocialQrPath(
  raw: string | undefined,
  publicDomain = process.env.S3_PUBLIC_DOMAIN || "http://localhost:9000/tzj-uploads-dev",
): string | undefined {
  if (!raw?.trim()) return undefined;
  let s = raw.trim();

  if (/^(uploads|content)\//.test(s)) return s;

  const base = publicDomain.replace(/\/$/, "");
  if (s.startsWith(`${base}/`)) {
    s = s.slice(base.length + 1);
  } else if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      s = u.pathname.replace(/^\/+/, "");
      const bucketPrefix = base.split("/").pop();
      if (bucketPrefix && s.startsWith(`${bucketPrefix}/`)) {
        s = s.slice(bucketPrefix.length + 1);
      }
    } catch {
      return undefined;
    }
  }

  s = s.replace(/^\/+/, "");
  if (/^(uploads|content)\//.test(s)) return s;

  // 站点静态 QR：/wechat.jpg → content/wechat.jpg（MinIO 对象 key）
  if (/^(wechat|douyin)\.(jpg|jpeg|png|webp|svg)$/i.test(s)) {
    return `content/${s}`;
  }

  return raw.trim();
}

/** 与 C 端 site.ts / social-channels 对齐的默认值 */
export const DEFAULT_SITE_PUBLIC_SETTINGS: SitePublicSettings = {
  contact: {
    phone: "0371-58691119",
    email: "REDACTED-EMAIL",
    address: {
      "zh-CN": "河南省郑州市高新技术开发区科学大道",
      "zh-TW": "河南省鄭州市高新技術開發區科學大道",
      en: "Kexue Avenue, High-tech Development Zone, Zhengzhou, Henan",
    },
  },
  legal: {
    beian: "豫ICP备XXXXXXXX号",
    beianUrl: "https://beian.miit.gov.cn",
  },
  social: {
    channels: [
      {
        id: "wechat-1",
        platform: "wechat",
        purpose: "contact",
        enabled: true,
        sortOrder: 0,
        qr: "content/wechat.jpg",
      },
      {
        id: "douyin-1",
        platform: "douyin",
        purpose: "follow",
        enabled: true,
        sortOrder: 1,
        qr: "content/douyin.jpg",
      },
    ],
  },
  analytics: {
    geoMode: "ip",
  },
};

export function mergeSitePublicSettings(
  partial?: Partial<SitePublicSettings> | null,
): SitePublicSettings {
  if (!partial) return DEFAULT_SITE_PUBLIC_SETTINGS;
  return {
    contact: { ...DEFAULT_SITE_PUBLIC_SETTINGS.contact, ...partial.contact },
    legal: { ...DEFAULT_SITE_PUBLIC_SETTINGS.legal, ...partial.legal },
    social: {
      channels: (partial.social?.channels?.length
        ? partial.social.channels
        : DEFAULT_SITE_PUBLIC_SETTINGS.social.channels
      ).map((c) => normalizeSocialChannel(c)),
    },
    analytics: {
      geoMode:
        partial.analytics?.geoMode ?? DEFAULT_SITE_PUBLIC_SETTINGS.analytics.geoMode,
    },
  };
}
