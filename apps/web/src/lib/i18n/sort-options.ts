import { getTranslations } from "next-intl/server";
import {
  BLOG_SORT_PRESETS,
  CASE_SORT_PRESETS,
  NEWS_SORT_PRESETS,
  TRADE_SHOW_SORT_PRESETS,
  type SortPreset,
} from "@/lib/content-list";

async function withLabels(
  presets: readonly Omit<SortPreset, "label">[],
  namespace: string,
): Promise<SortPreset[]> {
  const t = await getTranslations(namespace);
  return presets.map((p) => ({ ...p, label: t(p.key) }));
}

export async function getCaseSortOptions(): Promise<SortPreset[]> {
  return withLabels(CASE_SORT_PRESETS, "content.sort.cases");
}

export async function getNewsSortOptions(): Promise<SortPreset[]> {
  return withLabels(NEWS_SORT_PRESETS, "content.sort.news");
}

export async function getBlogSortOptions(): Promise<SortPreset[]> {
  return withLabels(BLOG_SORT_PRESETS, "content.sort.blog");
}

export async function getTradeShowSortOptions(): Promise<SortPreset[]> {
  return withLabels(TRADE_SHOW_SORT_PRESETS, "content.sort.tradeShows");
}
