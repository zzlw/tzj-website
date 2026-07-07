import { defineRouting } from "next-intl/routing";

export const locales = ["zh-CN", "zh-TW", "en"] as const;
export type AppLocale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "zh-CN",
  /** 默认语言无前缀，保持现有 URL；其他语言使用 /zh-TW、/en 前缀 */
  localePrefix: "as-needed",
  /**
   * 显式设置 cookie path 为 "/"，避免浏览器默认将 cookie 绑定到当前路径。
   * 例如用户在 /en 切换回 zh-CN 后，cookie 若仅作用于 /en 路径，
   * 后续访问无前缀路由（如 /cases）时 cookie 不会被发送，导致 locale 回退。
   *
   * maxAge: 365 天，确保语言偏好在会话间持久化。
   */
  localeCookie: {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  },
});
