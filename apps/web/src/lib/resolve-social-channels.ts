import type {
  SitePublicSettings,
  SocialChannelPurpose,
  SocialChannelSetting,
  SocialPlatformId,
} from "@tzj/types";
import type { SocialChannelId } from "@/lib/social-channels";
import type { SocialChannelItem } from "@/components/contact/SocialChannelBar";

const PLATFORM_LABEL_KEYS: Record<SocialPlatformId, string> = {
  wechat: "wechatLabel",
  douyin: "douyinLabel",
  weibo: "weiboLabel",
  xiaohongshu: "xiaohongshuLabel",
};

function channelPurpose(channel: SocialChannelSetting): SocialChannelPurpose {
  return channel.purpose ?? (channel.platform === "wechat" ? "contact" : "follow");
}

function channelLabel(channel: SocialChannelSetting, t: (key: string) => string): string {
  if (channel.platform === "wechat") {
    return channelPurpose(channel) === "contact"
      ? t("wechatServiceLabel")
      : t("wechatOfficialLabel");
  }
  return t(PLATFORM_LABEL_KEYS[channel.platform]);
}

function toBarItem(channel: SocialChannelSetting, t: (key: string) => string): SocialChannelItem {
  return {
    key: channel.id,
    platform: channel.platform as SocialChannelId,
    label: channelLabel(channel, t),
    qr: channel.qr,
    href: channel.href,
  };
}

/** CMS 社媒配置 → 页脚/图标栏（按用途筛选） */
export function resolveSocialChannels(
  settings: SitePublicSettings,
  purpose: SocialChannelPurpose,
  t: (key: string) => string,
): SocialChannelItem[] {
  return settings.social.channels
    .filter((c) => c.enabled && channelPurpose(c) === purpose && (c.qr || c.href))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => toBarItem(c, t));
}

/** 联系页二维码卡片（按用途筛选，含平台信息） */
export function resolveSocialQrChannels(
  settings: SitePublicSettings,
  purpose: SocialChannelPurpose,
  t: (key: string) => string,
) {
  return settings.social.channels
    .filter((c) => c.enabled && channelPurpose(c) === purpose && c.qr)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({
      id: c.id,
      label: channelLabel(c, t),
      qr: c.qr!,
      platform: c.platform,
    }));
}

/** 联系页全部二维码（合并即时沟通 + 关注） */
export function resolveAllSocialQrChannels(
  settings: SitePublicSettings,
  t: (key: string) => string,
) {
  return settings.social.channels
    .filter((c) => c.enabled && c.qr)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({
      id: c.id,
      label: channelLabel(c, t),
      qr: c.qr!,
      platform: c.platform,
      scanHint:
        channelPurpose(c) === "contact" ? t("scanToAdd") : t("scanToFollow"),
    }));
}
