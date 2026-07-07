import { defineRouting } from "next-intl/routing";

export const locales = ["zh-CN", "zh-TW", "en"] as const;
export type AppLocale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "zh-CN",
  /**
   * 所有语言都使用 URL 前缀（如 /zh-CN/cases、/en/cases）
   *
   * 采用此策略的原因：
   * 1. SEO 友好：每个语言版本有独立 URL，便于搜索引擎索引
   * 2. CDN 缓存友好：不同语言的页面可以独立缓存
   * 3. 实现简单可靠：不需要处理 cookie 作用域问题
   * 4. 符合主流实践：大型国际化站点（Shopify、Stripe、Vercel）都采用此策略
   */
  localePrefix: "always",
});
