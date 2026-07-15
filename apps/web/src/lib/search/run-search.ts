import type { AppLocale } from '@/i18n/routing';
import { getBlogs, getCases, getNewsList, getTradeShows } from '@/lib/api';
import { loadMessages } from '@/lib/i18n/load-messages';
import { SOLUTION_META } from '@/lib/solutions';
import { buildStaticSearchEntries, searchStaticEntries } from './static-index';
import type { SearchOptions, SearchResponse, SearchResult } from './types';

const CMS_FETCH_LIMIT = 100;
const SUGGEST_LIMIT = 6;
const SUGGEST_CMS_LIMIT = 4;
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 48;

const GROUP_ORDER: SearchResult['group'][] = [
  'page',
  'solution',
  'case',
  'news',
  'blog',
  'tradeShow',
];

function pickSummary(...candidates: Array<string | null | undefined>): string {
  for (const c of candidates) {
    if (c?.trim()) return c.trim();
  }
  return '';
}

function navLabel(messages: Record<string, unknown>, key: string): string {
  const nav = messages.nav as Record<string, string> | undefined;
  return nav?.[key] ?? key;
}

function solutionName(messages: Record<string, unknown>, slug: string): string {
  const solutions = messages.solutions as Record<string, { name?: string }> | undefined;
  return solutions?.[slug]?.name ?? slug;
}

async function loadSearchMessages(locale: AppLocale): Promise<Record<string, unknown>> {
  const core = await loadMessages(locale, '/search');
  let solutionsBlock: Record<string, unknown> = {};
  try {
    const mod = await import(`@/messages/${locale}/solutions.json`);
    solutionsBlock = mod.default as Record<string, unknown>;
  } catch {
    /* optional module */
  }
  return { ...core, solutions: solutionsBlock.solutions ?? {} };
}

function cmsCaseResults(
  data: Array<{
    id: string;
    slug: string;
    title: string;
    summary?: string | null;
    description?: string | null;
  }>,
): SearchResult[] {
  return data.map((item) => ({
    id: `case:${item.id}`,
    title: item.title,
    href: `/cases/${item.slug}`,
    group: 'case' as const,
    excerpt: pickSummary(item.summary, item.description),
  }));
}

function cmsNewsResults(
  data: Array<{ id: string; slug: string; title: string; summary?: string | null }>,
): SearchResult[] {
  return data.map((item) => ({
    id: `news:${item.id}`,
    title: item.title,
    href: `/resources/news/${item.slug}`,
    group: 'news' as const,
    excerpt: pickSummary(item.summary),
  }));
}

function cmsBlogResults(
  data: Array<{
    id: string;
    slug: string;
    title: string;
    excerpt?: string | null;
    summary?: string | null;
  }>,
): SearchResult[] {
  return data.map((item) => ({
    id: `blog:${item.id}`,
    title: item.title,
    href: `/resources/blog/${item.slug}`,
    group: 'blog' as const,
    excerpt: pickSummary(item.excerpt, item.summary),
  }));
}

function cmsTradeShowResults(
  data: Array<{
    id: string;
    slug: string;
    title: string;
    summary?: string | null;
    location?: string | null;
  }>,
): SearchResult[] {
  return data.map((item) => ({
    id: `tradeShow:${item.id}`,
    title: item.title,
    href: `/resources/trade-shows/${item.slug}`,
    group: 'tradeShow' as const,
    excerpt: pickSummary(item.summary, item.location),
  }));
}

function sortResults(results: SearchResult[], locale: AppLocale): SearchResult[] {
  return [...results].sort((a, b) => {
    const ga = GROUP_ORDER.indexOf(a.group);
    const gb = GROUP_ORDER.indexOf(b.group);
    if (ga !== gb) return ga - gb;
    return a.title.localeCompare(b.title, locale);
  });
}

function relevanceRank(title: string, q: string): number {
  const lower = title.toLowerCase();
  const query = q.toLowerCase();
  if (lower.startsWith(query)) return 0;
  if (lower.includes(query)) return 1;
  return 2;
}

/** 联想排序：相关度优先，其次内容类型。 */
function sortSuggestions(results: SearchResult[], q: string, locale: AppLocale): SearchResult[] {
  return [...results].sort((a, b) => {
    const ra = relevanceRank(a.title, q);
    const rb = relevanceRank(b.title, q);
    if (ra !== rb) return ra - rb;
    const ga = GROUP_ORDER.indexOf(a.group);
    const gb = GROUP_ORDER.indexOf(b.group);
    if (ga !== gb) return ga - gb;
    return a.title.localeCompare(b.title, locale);
  });
}

/** 站点全局搜索：静态页 + CMS 内容聚合，内存分页。 */
export async function runSiteSearch(
  query: string,
  locale: AppLocale,
  options: SearchOptions = {},
): Promise<SearchResponse> {
  const q = query.trim();
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, options.limit ?? DEFAULT_PAGE_SIZE));

  if (q.length < 2) {
    return {
      query: q,
      results: [],
      pagination: { page: 1, pageSize, total: 0, totalPages: 1 },
    };
  }

  const messages = await loadSearchMessages(locale);
  const staticEntries = buildStaticSearchEntries(
    (key) => navLabel(messages, key),
    (slug) => solutionName(messages, slug),
  );

  const staticResults = searchStaticEntries(staticEntries, q);

  let cmsResults: SearchResult[] = [];
  try {
    const [casesRes, newsRes, blogsRes, tradeShowsRes] = await Promise.all([
      getCases({ search: q, limit: CMS_FETCH_LIMIT, page: 1 }),
      getNewsList({ search: q, limit: CMS_FETCH_LIMIT, page: 1 }),
      getBlogs({ search: q, limit: CMS_FETCH_LIMIT, page: 1 }),
      getTradeShows({ search: q, limit: CMS_FETCH_LIMIT, page: 1 }),
    ]);

    cmsResults = [
      ...cmsCaseResults(casesRes.data ?? []),
      ...cmsNewsResults(newsRes.data ?? []),
      ...cmsBlogResults(blogsRes.data ?? []),
      ...cmsTradeShowResults(tradeShowsRes.data ?? []),
    ];
  } catch {
    /* API 不可用时仍返回静态结果 */
  }

  const merged = sortResults([...staticResults, ...cmsResults], locale);
  const total = merged.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;
  const results = merged.slice(offset, offset + pageSize);

  return {
    query: q,
    results,
    pagination: {
      page: safePage,
      pageSize,
      total,
      totalPages,
    },
  };
}

/** 输入联想：轻量查询，1 字符起提示静态页，2 字符起含 CMS。 */
export async function runSearchSuggestions(
  query: string,
  locale: AppLocale,
): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 1) return [];

  const messages = await loadSearchMessages(locale);
  const staticEntries = buildStaticSearchEntries(
    (key) => navLabel(messages, key),
    (slug) => solutionName(messages, slug),
  );

  const minLength = q.length >= 2 ? 2 : 1;
  const staticResults = searchStaticEntries(staticEntries, q, {
    minLength,
    limit: SUGGEST_LIMIT,
  });

  if (q.length < 2) return staticResults;

  let cmsResults: SearchResult[] = [];
  try {
    const [casesRes, newsRes, blogsRes, tradeShowsRes] = await Promise.all([
      getCases({ search: q, limit: SUGGEST_CMS_LIMIT, page: 1 }),
      getNewsList({ search: q, limit: SUGGEST_CMS_LIMIT, page: 1 }),
      getBlogs({ search: q, limit: SUGGEST_CMS_LIMIT, page: 1 }),
      getTradeShows({ search: q, limit: SUGGEST_CMS_LIMIT, page: 1 }),
    ]);

    cmsResults = [
      ...cmsCaseResults(casesRes.data ?? []),
      ...cmsNewsResults(newsRes.data ?? []),
      ...cmsBlogResults(blogsRes.data ?? []),
      ...cmsTradeShowResults(tradeShowsRes.data ?? []),
    ];
  } catch {
    /* 静态提示仍可用 */
  }

  return sortSuggestions([...staticResults, ...cmsResults], q, locale).slice(0, SUGGEST_LIMIT);
}

void SOLUTION_META;
