import { defineRouting } from "next-intl/routing";

export const locales = ["zh-CN", "zh-TW", "en"] as const;
export type AppLocale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "zh-CN",
  /** 默认语言无前缀，保持现有 URL；其他语言使用 /zh-TW、/en 前缀 */
  localePrefix: "as-needed",
});
