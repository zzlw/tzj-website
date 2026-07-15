/** 访客地区定位方式：ip=服务端 IP 解析（默认），gps=浏览器 Geolocation + 逆地理编码 */
export type AnalyticsGeoMode = 'ip' | 'gps';

/** 页面浏览记录中的定位依据 */
export type PageViewGeoSource = 'ip' | 'gps';

/** 社媒平台标识（与 C 端图标映射一致） */
export type SocialPlatformId = 'wechat' | 'douyin' | 'weibo' | 'xiaohongshu';

/** 渠道用途：contact=联系/客服（扫码添加），follow=社媒关注（扫码关注） */
export type SocialChannelPurpose = 'contact' | 'follow';

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
  'zh-CN'?: string;
  'zh-TW'?: string;
  en?: string;
}

/** 客服在线时间（C 端聊天兜底判定「是否下班」的依据，按业务时区计算） */
export interface BusinessHours {
  /** 是否启用工作时间判定；关闭则前端不自动降级为离线 */
  enabled: boolean;
  /** IANA 时区，如 "Asia/Shanghai" */
  timezone: string;
  /** 工作星期（0=周日 … 6=周六） */
  weekdays: number[];
  /** 开始小时 0–23 */
  startHour: number;
  /** 结束小时 0–23（按小时区间，不含 endHour，如 18 表示 18:00 前） */
  endHour: number;
  /** 节假日（"MM-DD"），命中则视为非工作时间 */
  holidays: string[];
}

/** 在线客服资料（C 端聊天窗口的客服头像、昵称、角色与首条招呼语） */
export interface AgentProfile {
  /** 客服昵称（聊天窗口标题与气泡署名） */
  name: string;
  /** 头像图片 URL 或对象 key，为空则用昵称首字兜底 */
  avatar: string;
  /** 角色/职称，展示在昵称下方，如「在线客服」 */
  title: string;
  /** 首条招呼语（支持 \n 换行） */
  greeting: string;
  /** 首次响应时间承诺（分钟），用于 C 端「通常 X 分钟内回复」SLA 提示；缺省走兜底文案 */
  responseMinutes?: number;
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
  /** 客服在线时间配置（后端下发，前端兜底判定离线） */
  businessHours: BusinessHours;
  /** 在线客服资料（头像 / 昵称 / 角色 / 招呼语） */
  agentProfile: AgentProfile;
}
