import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/routing';
import { getBlogs, getCases, getNewsList } from '@/lib/api';
import { staticRoutes } from '@/lib/routes';
import { localizedUrl } from '@/lib/seo';
import { getAllSolutionSlugs } from '@/lib/solutions';

const PAGE_SIZE = 500;
/** 分页保险丝：防御接口异常导致的死循环（500×20 = 1 万条上限） */
const MAX_PAGES = 20;

/** 分页取尽：单次 500 条封顶会让超量内容静默从 sitemap 消失（P2-8） */
async function fetchSlugs(
  fetcher: (params: { limit: number; page: number }) => Promise<{ data?: { slug: string }[] }>,
): Promise<string[]> {
  const slugs: string[] = [];
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await fetcher({ limit: PAGE_SIZE, page });
      const batch = (res.data ?? []).map((item) => item.slug);
      slugs.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }
  } catch {
    // 接口异常时返回已取到的部分，避免整站 sitemap 失败
  }
  return slugs;
}

type SitemapEntry = MetadataRoute.Sitemap[number];

/**
 * 将站内路径展开为三语言条目（URL 均带 locale 前缀，直接 200 零跳转），
 * 并互挂 hreflang alternates（x-default 指向默认语 zh-CN）。
 */
function localizedEntries(
  path: string,
  options: Pick<SitemapEntry, 'lastModified' | 'changeFrequency' | 'priority'>,
): MetadataRoute.Sitemap {
  const languages: Record<string, string> = Object.fromEntries(
    locales.map((l) => [l, localizedUrl(l, path)]),
  );
  languages['x-default'] = localizedUrl('zh-CN', path);

  return locales.map((locale) => ({
    url: localizedUrl(locale, path),
    ...options,
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries = staticRoutes.flatMap((route) =>
    localizedEntries(route.path, {
      lastModified: new Date(),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    }),
  );

  const [caseSlugs, blogSlugs, newsSlugs] = await Promise.all([
    fetchSlugs(getCases),
    fetchSlugs(getBlogs),
    fetchSlugs(getNewsList),
  ]);

  const caseEntries = caseSlugs.flatMap((slug) =>
    localizedEntries(`/cases/${slug}`, {
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }),
  );

  const blogEntries = blogSlugs.flatMap((slug) =>
    localizedEntries(`/resources/blog/${slug}`, {
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    }),
  );

  const newsEntries = newsSlugs.flatMap((slug) =>
    localizedEntries(`/resources/news/${slug}`, {
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    }),
  );

  const solutionEntries = getAllSolutionSlugs().flatMap((slug) =>
    localizedEntries(`/solutions/${slug}`, {
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }),
  );

  return [...staticEntries, ...caseEntries, ...blogEntries, ...newsEntries, ...solutionEntries];
}
