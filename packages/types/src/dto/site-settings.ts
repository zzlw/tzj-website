/** 访客地区定位方式：ip=服务端 IP 解析（默认），gps=浏览器 Geolocation + 逆地理编码 */
export type AnalyticsGeoMode = "ip" | "gps";

/** 页面浏览记录中的定位依据 */
export type PageViewGeoSource = "ip" | "gps";

/** 社媒平台标识（与 C 端图标映射一致） */
export type SocialPlatformId = "wechat" | "douyin" | "weibo" | "xiaohongshu";

/** 渠道用途：contact=联系/客服（扫码添加），follow=社媒关注（扫码关注） */
export type SocialChannelPurpose = "contact" | "follow";

export interface SocialChannelSetting {
  id: string;
  platform: SocialPlatformId;
  /** 默认：微信→contact，其余→follow */
  purpose?: SocialChannelPurpose;
  enabled: boolean;
  sortOrder: number;
  /** 二维码图片 URL 或 /public 路径 */
  qr?: string;
  /** 外链（如微博主页），与 qr 二选一或并存（优先 href） */
  href?: string;
}

export interface LocalizedText {
  "zh-CN"?: string;
  "zh-TW"?: string;
  en?: string;
}

/** 官网公开站点设置（C 端 + 页脚 + 联系页消费） */
export interface SitePublicSettings {
  contact: {
    phone: string;
    email: string;
    address: LocalizedText;
  };
  legal: {
    beian: string;
    beianUrl: string;
  };
  social: {
    channels: SocialChannelSetting[];
  };
  analytics: {
    /** 默认 ip — 业内惯例，无需用户授权、隐私友好 */
    geoMode: AnalyticsGeoMode;
  };
}
