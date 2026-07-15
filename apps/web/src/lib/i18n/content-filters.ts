import { getTranslations } from 'next-intl/server';
import type { ContentFilterDef } from '@/components/content/ContentListToolbar';
import type { ContentOption } from '@/lib/content-labels';
import {
  BLOG_CATEGORY_VALUES,
  CASE_TYPE_VALUES,
  NEWS_CATEGORY_VALUES,
  TRADE_SHOW_TYPE_VALUES,
} from '@/lib/content-labels';

function mapOptions(
  values: readonly string[],
  t: (key: string) => string,
  prefix: string,
): ContentOption[] {
  return values.map((value) => ({ value, label: t(`${prefix}.${value}`) }));
}

export async function getCaseTypeFilter(): Promise<ContentFilterDef> {
  const t = await getTranslations('content.filters');
  const tc = await getTranslations('content.categories.cases');
  return {
    key: 'type',
    label: t('allTypes'),
    options: mapOptions(CASE_TYPE_VALUES, tc, 'types'),
  };
}

export async function getNewsCategoryFilter(): Promise<ContentFilterDef> {
  const t = await getTranslations('content.filters');
  const tc = await getTranslations('content.categories.news');
  return {
    key: 'category',
    label: t('allCategories'),
    options: mapOptions(NEWS_CATEGORY_VALUES, tc, 'categories'),
  };
}

export async function getBlogCategoryFilter(): Promise<ContentFilterDef> {
  const t = await getTranslations('content.filters');
  const tc = await getTranslations('content.categories.blog');
  return {
    key: 'category',
    label: t('allCategories'),
    options: mapOptions(BLOG_CATEGORY_VALUES, tc, 'categories'),
  };
}

export async function getTradeShowTypeFilter(): Promise<ContentFilterDef> {
  const t = await getTranslations('content.filters');
  const tc = await getTranslations('content.categories.tradeShows');
  return {
    key: 'eventType',
    label: t('allTypes'),
    options: mapOptions(TRADE_SHOW_TYPE_VALUES, tc, 'types'),
  };
}
