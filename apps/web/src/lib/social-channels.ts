/** 社媒渠道 ID — 新增平台时扩展此联合类型 */
export type SocialChannelId = 'wechat' | 'douyin' | 'weibo' | 'xiaohongshu';

export type SocialChannel = {
  id: SocialChannelId;
  /** contact 命名空间下的 i18n key */
  labelKey: 'wechatLabel' | 'douyinLabel' | 'weiboLabel' | 'xiaohongshuLabel';
  /** 扫码关注 — 有 qr 时在页脚弹出、联系页展示 */
  qr?: string;
  /** 外链跳转 — 有 href 时直接打开（如微博主页） */
  href?: string;
};

/**
 * 社媒渠道配置（单一来源，便于后期增删）
 * - 有 qr：页脚图标 + Popover；联系页展示二维码卡片
 * - 有 href：页脚图标外链（无需二维码）
 */
export const SOCIAL_CHANNELS: SocialChannel[] = [
  { id: 'wechat', labelKey: 'wechatLabel', qr: 'content/wechat.jpg' },
  { id: 'douyin', labelKey: 'douyinLabel', qr: 'content/douyin.jpg' },
  // 后期启用示例：
  // { id: "weibo", labelKey: "weiboLabel", href: "https://weibo.com/u/xxxx" },
  // { id: "xiaohongshu", labelKey: "xiaohongshuLabel", qr: "/xiaohongshu.jpg" },
];

export type SocialChannelWithQr = SocialChannel & { qr: string };

export function socialChannelsWithQr(): SocialChannelWithQr[] {
  return SOCIAL_CHANNELS.filter((c): c is SocialChannelWithQr => Boolean(c.qr));
}
