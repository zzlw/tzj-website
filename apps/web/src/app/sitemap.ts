import type { MetadataRoute } from 'next';
import { getBlogs, getCases, getNewsList } from '@/lib/api';
import { staticRoutes } from '@/lib/routes';
import { siteConfig } from '@/lib/site';
import { getAllSolutionSlugs } from '@/lib/solutions';

async function fetchSlugs(
  fetcher: (params: { limit: number; page: number }) => Promise<{ data?: { slug: string }[] }>,
): Promise<string[]> {
  try {
    const res = await fetcher({ limit: 500, page: 1 });
    return (res.data ?? []).map((item) => item.slug);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteConfig.url;

  const staticEntries = staticRoutes.map((route) => ({
    url: `${baseUrl}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const [caseSlugs, blogSlugs, newsSlugs] = await Promise.all([
    fetchSlugs(getCases),
    fetchSlugs(getBlogs),
    fetchSlugs(getNewsList),
  ]);

  const caseEntries = caseSlugs.map((slug) => ({
    url: `${baseUrl}/cases/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  const blogEntries = blogSlugs.map((slug) => ({
    url: `${baseUrl}/resources/blog/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));

  const newsEntries = newsSlugs.map((slug) => ({
    url: `${baseUrl}/resources/news/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));

  const solutionEntries = getAllSolutionSlugs().map((slug) => ({
    url: `${baseUrl}/solutions/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...staticEntries, ...caseEntries, ...blogEntries, ...newsEntries, ...solutionEntries];
}
