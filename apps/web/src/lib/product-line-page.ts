import { getCase } from '@/lib/api';
import { getProductLine, type ProductLine } from '@/lib/product-catalog';
import { siteCoverByHref } from '@/lib/site-cover';

export type FeaturedCaseCard = {
  slug: string;
  title: string;
  location: string;
  summary: string;
  image: string;
};

export function requireProductLine(id: string): ProductLine {
  const line = getProductLine(id);
  if (!line) throw new Error(`missing product line: ${id}`);
  return line;
}

/** 拉取产品线关联案例；失败或无封面则跳过。 */
export async function fetchFeaturedCases(slugs: string[] | undefined): Promise<FeaturedCaseCard[]> {
  if (!slugs?.length) return [];
  const rows = await Promise.all(
    slugs.map(async (slug) => {
      try {
        const res = await getCase(slug);
        const item = res.data;
        if (!item?.coverImage) return null;
        const summary = (item as unknown as { summary?: string }).summary ?? item.description;
        return {
          slug,
          title: item.title,
          location: item.location ?? '',
          summary,
          image: item.coverImage,
        };
      } catch {
        return null;
      }
    }),
  );
  return rows.filter((c): c is FeaturedCaseCard => c !== null);
}

export function relatedLinksWithImages(
  links: Array<{ label: string; desc: string }>,
  hrefs: readonly string[],
): Array<{ label: string; desc: string; href: string; image?: string }> {
  return links.map((l, i) => {
    const href = hrefs[i] ?? hrefs[0] ?? '/';
    return {
      ...l,
      href,
      // 统一封面解析：覆盖产品线/子SKU/why-us/resources/solutions/cases 等全部目标
      image: siteCoverByHref(href),
    };
  });
}
