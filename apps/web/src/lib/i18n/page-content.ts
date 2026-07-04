import type { AppLocale } from "@/i18n/routing";
export { pageContentIdFromPath } from "./page-ids";

/** 加载静态页正文 JSON（按 locale + pageId）。 */
export async function getPageContent<T = Record<string, unknown>>(
  pageId: string,
  locale: AppLocale,
): Promise<T> {
  const mod = await import(`../../content/pages/${locale}/${pageId}.json`);
  return mod.default as T;
}
