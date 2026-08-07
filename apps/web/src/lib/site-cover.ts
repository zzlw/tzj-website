/**
 * 全站统一「路由 → 封面图」解析器（RelatedLinks 等卡片的单一数据源）。
 *
 * 背景：此前各页面分别从 whyUsCoverByHref / productLineByHref /
 * RESOURCES_CARD_BY_HREF 等各自注册表取图，跨模块 href（如 /cases、
 * /resources/*、/solutions/*）取不到图导致「延伸了解」卡片缺图。
 * 新增路由目标时只需在此补充映射，避免再次出现缺图。
 */
import { productLineByHref } from './product-catalog';
import { subpageCoverByHref } from './product-images';
import { RESOURCES_CARD_BY_HREF } from './resources-images';
import { SOLUTION_META } from './solutions';
import { whyUsCoverByHref } from './why-us-images';

/** 无专属注册表的 href → 封面图（选用各板块代表性素材）。 */
const EXTRA_COVER_BY_HREF: Record<string, string> = {
  '/cases': '/media/case-caseshow-57-66-hero.webp',
  '/resources/blog': '/media/burn-room.webp',
  '/resources/news': '/media/news-hazmat-capability-expansion-hero.webp',
  '/resources/trade-shows': '/media/trade-show-china-fire-expo-hero.webp',
};

/** /solutions/{slug} → hub 卡片图。 */
function solutionCoverByHref(href: string): string | undefined {
  if (!href.startsWith('/solutions/')) return undefined;
  const slug = href.slice('/solutions/'.length).split('/')[0];
  const meta = SOLUTION_META.find((s) => s.slug === slug);
  return meta ? `/media/solution/${meta.slug}-card.webp` : undefined;
}

/**
 * 按 href 解析卡片封面图，依次查询：
 * 产品线 → 子 SKU 回退 → why-us → resources → solutions → 补充映射。
 * 未收录时返回 undefined（卡片按无图样式渲染）。
 */
export function siteCoverByHref(href: string): string | undefined {
  return (
    productLineByHref(href)?.image ??
    subpageCoverByHref(href) ??
    whyUsCoverByHref(href) ??
    RESOURCES_CARD_BY_HREF[href] ??
    solutionCoverByHref(href) ??
    EXTRA_COVER_BY_HREF[href]
  );
}
