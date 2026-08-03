import type { PaginatedResponse } from '@tzj/types';

export interface ContentListState {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filter?: string;
}

export interface NormalizedPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type SortPreset = {
  key: string;
  label: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
};

export const CASE_SORT_PRESETS = [
  { key: 'completionDesc', sortBy: 'completionDate', sortOrder: 'desc' },
  { key: 'completionAsc', sortBy: 'completionDate', sortOrder: 'asc' },
  { key: 'titleAsc', sortBy: 'title', sortOrder: 'asc' },
  { key: 'titleDesc', sortBy: 'title', sortOrder: 'desc' },
  { key: 'locationAsc', sortBy: 'location', sortOrder: 'asc' },
] as const;

export const NEWS_SORT_PRESETS = [
  { key: 'publishedDesc', sortBy: 'publishedAt', sortOrder: 'desc' },
  { key: 'publishedAsc', sortBy: 'publishedAt', sortOrder: 'asc' },
  { key: 'titleAsc', sortBy: 'title', sortOrder: 'asc' },
  { key: 'titleDesc', sortBy: 'title', sortOrder: 'desc' },
] as const;

export const BLOG_SORT_PRESETS = [
  { key: 'publishedDesc', sortBy: 'publishedAt', sortOrder: 'desc' },
  { key: 'publishedAsc', sortBy: 'publishedAt', sortOrder: 'asc' },
  { key: 'titleAsc', sortBy: 'title', sortOrder: 'asc' },
  { key: 'titleDesc', sortBy: 'title', sortOrder: 'desc' },
] as const;

export const TRADE_SHOW_SORT_PRESETS = [
  { key: 'startDesc', sortBy: 'startDate', sortOrder: 'desc' },
  { key: 'startAsc', sortBy: 'startDate', sortOrder: 'asc' },
  { key: 'titleAsc', sortBy: 'title', sortOrder: 'asc' },
  { key: 'titleDesc', sortBy: 'title', sortOrder: 'desc' },
] as const;

/** @deprecated 请使用 getCaseSortOptions + i18n */
export const CASE_SORT_OPTIONS: SortPreset[] = CASE_SORT_PRESETS.map((p) => ({
  ...p,
  label: p.key,
}));

/** @deprecated */
export const NEWS_SORT_OPTIONS: SortPreset[] = NEWS_SORT_PRESETS.map((p) => ({
  ...p,
  label: p.key,
}));

/** @deprecated */
export const BLOG_SORT_OPTIONS: SortPreset[] = BLOG_SORT_PRESETS.map((p) => ({
  ...p,
  label: p.key,
}));

/** @deprecated */
export const TRADE_SHOW_SORT_OPTIONS: SortPreset[] = TRADE_SHOW_SORT_PRESETS.map((p) => ({
  ...p,
  label: p.key,
}));

function spString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export function parseContentListState(
  raw: Record<string, string | string[] | undefined>,
  defaults: {
    limit?: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    filterKey?: string;
  },
): ContentListState {
  const page = Math.max(1, Number(spString(raw.page)) || 1);
  const limit = Math.min(48, Math.max(1, Number(spString(raw.limit)) || defaults.limit || 9));
  const sortBy = spString(raw.sortBy) || defaults.sortBy;
  const sortOrder = spString(raw.sortOrder) === 'asc' ? 'asc' : 'desc';
  const filterKey = defaults.filterKey;
  const filter =
    filterKey && spString(raw[filterKey]) && spString(raw[filterKey]) !== 'all'
      ? spString(raw[filterKey])
      : undefined;

  return { page, limit, sortBy, sortOrder, filter };
}

export function sortPresetValue(p: SortPreset): string {
  return `${p.sortBy}:${p.sortOrder}`;
}

export function parseSortPreset(value: string, fallback: SortPreset): SortPreset {
  const [sortBy, sortOrder] = value.split(':');
  if (!sortBy) return fallback;
  return {
    key: fallback.key,
    label: fallback.label,
    sortBy,
    sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
  };
}

export function buildListQuery(state: ContentListState, filterKey?: string) {
  return {
    page: state.page,
    limit: state.limit,
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
    ...(filterKey && state.filter ? { [filterKey]: state.filter } : {}),
  };
}

export function normalizePagination(
  pagination?: PaginatedResponse<unknown>['pagination'] & { limit?: number },
  fallbackPage = 1,
  fallbackLimit = 9,
): NormalizedPagination {
  if (!pagination) {
    return { page: fallbackPage, pageSize: fallbackLimit, total: 0, totalPages: 1 };
  }
  const pageSize = pagination.pageSize ?? pagination.limit ?? fallbackLimit;
  return {
    page: pagination.page ?? fallbackPage,
    pageSize,
    total: pagination.total ?? 0,
    totalPages: Math.max(1, pagination.totalPages ?? 1),
  };
}

import { resolveMediaUrl } from './media-url';

export function pickCoverImage(src?: string | null, fallback = '/media/tower-wylie.jpg') {
  return resolveMediaUrl(src?.trim() ? src : fallback);
}

export function pickSummary(...candidates: Array<string | null | undefined>) {
  for (const c of candidates) {
    if (c?.trim()) return c.trim();
  }
  return '';
}
