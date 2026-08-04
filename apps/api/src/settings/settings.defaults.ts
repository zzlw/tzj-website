import type {
  LocalizedText,
  SitePublicSettings,
  SocialChannelSetting,
  SocialPlatformId,
} from '@tzj/types';

export const SITE_PUBLIC_SETTING_KEY = 'site.public';

/** 官网设置缓存 TTL（秒）配置 key：C 端 web 按此值缓存站点设置；0 = 不缓存，每次访问实时读取 */
export const CACHE_TTL_SETTING_KEY = 'site.cacheTtl';

/** 默认缓存时长：300s（5 分钟），与 v2 前写死值一致，保证无配置时行为不变 */
export const DEFAULT_CACHE_TTL_SECONDS = 300;

/**
 * 将历史遗留的单一字符串或任意对象规范为 LocalizedText。
 * 老数据中 chatPrompts 存的是纯字符串，此处迁移为 { 'zh-CN': str }，
 * 避免类型破坏；对象则只保留三种合法语言键。
 */
export function normalizeLocalizedText(value: unknown): LocalizedText {
  if (typeof value === 'string') {
    return value.trim() ? { 'zh-CN': value.trim() } : {};
  }
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: LocalizedText = {};
    if (typeof source['zh-CN'] === 'string') out['zh-CN'] = source['zh-CN'] as string;
    if (typeof source['zh-TW'] === 'string') out['zh-TW'] = source['zh-TW'] as string;
    if (typeof source.en === 'string') out.en = source.en as string;
    return out;
  }
  return {};
}

/** 微信默认客服，其余默认社媒关注 */
export function defaultChannelPurpose(platform: SocialPlatformId): 'contact' | 'follow' {
  return platform === 'wechat' ? 'contact' : 'follow';
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
  publicDomain = process.env.S3_PUBLIC_DOMAIN || 'http://localhost:9000/tzj-uploads-dev',
): string | undefined {
  if (!raw?.trim()) return undefined;
  let s = raw.trim();

  if (/^(uploads|content)\//.test(s)) return s;

  const base = publicDomain.replace(/\/$/, '');
  if (s.startsWith(`${base}/`)) {
    s = s.slice(base.length + 1);
  } else if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      s = u.pathname.replace(/^\/+/, '');
      // Strip any bucket name (first path segment) if key not at root
      if (!/^(uploads|content)\//.test(s)) {
        const slashIdx = s.indexOf('/');
        if (slashIdx > 0) s = s.slice(slashIdx + 1);
      }
    } catch {
      return undefined;
    }
  }

  s = s.replace(/^\/+/, '');
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
    phone: '0371-58691119',
    email: 'contact@tzjii.com',
    address: {
      'zh-CN': '河南省郑州市高新技术开发区科学大道',
      'zh-TW': '河南省鄭州市高新技術開發區科學大道',
      en: 'Kexue Avenue, High-tech Development Zone, Zhengzhou, Henan',
    },
  },
  legal: {
    beian: '豫ICP备20013982号',
    beianUrl: 'https://beian.miit.gov.cn',
    gonganBeian: '豫公网安备41010702004123号',
    gonganBeianUrl: 'https://beian.mps.gov.cn/#/query/webSearch',
  },
  social: {
    channels: [
      {
        id: 'wechat-1',
        platform: 'wechat',
        purpose: 'contact',
        enabled: true,
        sortOrder: 0,
        qr: 'content/wechat.jpg',
      },
      {
        id: 'douyin-1',
        platform: 'douyin',
        purpose: 'follow',
        enabled: true,
        sortOrder: 1,
        qr: 'content/douyin.jpg',
      },
    ],
  },
  analytics: {
    geoMode: 'ip',
  },
  businessHours: {
    enabled: true,
    timezone: 'Asia/Shanghai',
    weekdays: [1, 2, 3, 4, 5],
    startHour: 9,
    endHour: 18,
    holidays: [],
  },
  agentProfile: {
    name: '客服小拓',
    avatar: '',
    title: '在线客服',
    greeting: '您好 👋\n\n请描述您的问题，我会尽快为您解答。',
    responseMinutes: 5,
  },
  chatPrompts: {
    offlineMessage: {},
    noAgentMessage: {},
  },
  screenWatermark: {
    enabled: false,
    text: '',
    opacity: 0.08,
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
      geoMode: partial.analytics?.geoMode ?? DEFAULT_SITE_PUBLIC_SETTINGS.analytics.geoMode,
      baiduHmId: partial.analytics?.baiduHmId,
    },
    businessHours: {
      enabled: partial.businessHours?.enabled ?? DEFAULT_SITE_PUBLIC_SETTINGS.businessHours.enabled,
      timezone:
        partial.businessHours?.timezone ?? DEFAULT_SITE_PUBLIC_SETTINGS.businessHours.timezone,
      weekdays: partial.businessHours?.weekdays?.length
        ? partial.businessHours.weekdays
        : DEFAULT_SITE_PUBLIC_SETTINGS.businessHours.weekdays,
      startHour:
        partial.businessHours?.startHour ?? DEFAULT_SITE_PUBLIC_SETTINGS.businessHours.startHour,
      endHour: partial.businessHours?.endHour ?? DEFAULT_SITE_PUBLIC_SETTINGS.businessHours.endHour,
      holidays:
        partial.businessHours?.holidays ?? DEFAULT_SITE_PUBLIC_SETTINGS.businessHours.holidays,
    },
    agentProfile: {
      name: partial.agentProfile?.name ?? DEFAULT_SITE_PUBLIC_SETTINGS.agentProfile.name,
      avatar: partial.agentProfile?.avatar ?? DEFAULT_SITE_PUBLIC_SETTINGS.agentProfile.avatar,
      title: partial.agentProfile?.title ?? DEFAULT_SITE_PUBLIC_SETTINGS.agentProfile.title,
      greeting:
        partial.agentProfile?.greeting ?? DEFAULT_SITE_PUBLIC_SETTINGS.agentProfile.greeting,
      responseMinutes:
        partial.agentProfile?.responseMinutes ??
        DEFAULT_SITE_PUBLIC_SETTINGS.agentProfile.responseMinutes,
    },
    chatPrompts: {
      offlineMessage: normalizeLocalizedText(partial.chatPrompts?.offlineMessage),
      noAgentMessage: normalizeLocalizedText(partial.chatPrompts?.noAgentMessage),
    },
    screenWatermark: {
      enabled:
        partial.screenWatermark?.enabled ?? DEFAULT_SITE_PUBLIC_SETTINGS.screenWatermark.enabled,
      text: partial.screenWatermark?.text ?? DEFAULT_SITE_PUBLIC_SETTINGS.screenWatermark.text,
      opacity:
        partial.screenWatermark?.opacity ?? DEFAULT_SITE_PUBLIC_SETTINGS.screenWatermark.opacity,
    },
  };
}
