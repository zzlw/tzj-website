import type { AppLocale } from "@/i18n/routing";

/** 各语言热门搜索词（静态配置，可按运营调整）。 */
export const POPULAR_SEARCHES: Record<AppLocale, readonly string[]> = {
  "zh-CN": ["消防训练塔", "模块化训练塔", "工程案例", "燃烧室", "联系我们"],
  "zh-TW": ["消防訓練塔", "模組化訓練塔", "工程案例", "燃燒室", "聯絡我們"],
  en: ["fire training tower", "modular tower", "project references", "burn room", "contact"],
};

export function getPopularSearches(locale: AppLocale): string[] {
  return [...POPULAR_SEARCHES[locale]];
}
