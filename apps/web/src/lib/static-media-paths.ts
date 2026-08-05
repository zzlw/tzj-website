import { blogPosts } from './blog';
import { caseStudies } from './cases';
import { newsItems } from './news';
import { PRODUCT_LINES } from './product-catalog';
import { SOLUTION_META } from './solutions';

/** 页面 / i18n JSON 中引用、未纳入下方模块数据的路径。 */
const EXTRA_SITE_MEDIA_PATHS = [
  '/media/alarm-1st.png',
  '/media/alarm-3rd.png',
  '/media/alarm-5th.png',
  '/media/alarm-highrise.png',
  '/media/series-1st-alarm.png',
  '/media/series-3rd-alarm.png',
  '/media/series-5th-alarm.png',
  '/media/series-highrise.png',
  '/media/burn-room.mp4',
  '/media/fixed-series.mp4',
  '/media/fixed-tower-custom-detail.png',
  '/media/fixed-tower-hero.jpg',
  '/media/fixed-tower-overview-concept.png',
  '/media/fixed-tower-series-thumb-a.png',
  '/media/fixed-tower.mp4',
  '/media/ft-case-01.png',
  '/media/ft-case-02.png',
  '/media/ft-case-03.png',
  '/media/case-henan-hero.png',
  '/media/case-henan-angle-wide.png',
  '/media/case-henan-angle-stair.png',
  '/media/case-henan-angle-panel.png',
  '/media/case-henan-angle-low.png',
  '/media/case-henan-structure.png',
  '/media/case-henan-burn.png',
  '/media/case-henan-fire-rescue-hero.webp',
  '/media/case-henan-fire-rescue-detail-hero.webp',
  '/media/case-henan-fire-rescue-gallery-1.webp',
  '/media/case-henan-fire-rescue-gallery-2.webp',
  '/media/case-henan-fire-rescue-gallery-3.webp',
  '/media/case-henan-fire-rescue-gallery-4.webp',
  '/media/case-gd-hero.png',
  '/media/case-gd-angle-wide.png',
  '/media/case-gd-angle-tower.png',
  '/media/case-gd-angle-burn.png',
  '/media/case-gd-angle-low.png',
  '/media/case-gd-interior.png',
  '/media/case-gd-lining.png',
  '/media/case-guangdong-cfbt-hero.webp',
  '/media/case-guangdong-cfbt-detail-hero.webp',
  '/media/case-guangdong-cfbt-gallery-1.webp',
  '/media/case-guangdong-cfbt-gallery-2.webp',
  '/media/case-guangdong-cfbt-gallery-3.webp',
  '/media/case-guangdong-cfbt-gallery-4.webp',
  '/media/case-js-hero.png',
  '/media/case-js-angle-wide.png',
  '/media/case-js-angle-stair.png',
  '/media/case-js-angle-yard.png',
  '/media/case-js-angle-low.png',
  '/media/case-js-platform.png',
  '/media/case-js-module.png',
  '/media/case-jiangsu-university-hero.webp',
  '/media/case-jiangsu-university-detail-hero.webp',
  '/media/case-jiangsu-university-gallery-1.webp',
  '/media/case-jiangsu-university-gallery-2.webp',
  '/media/case-jiangsu-university-gallery-3.webp',
  '/media/case-jiangsu-university-gallery-4.webp',
  '/media/case-caseshow-57-66-hero.webp',
  '/media/case-caseshow-57-66-detail-hero.webp',
  '/media/case-caseshow-57-66-gallery-1.webp',
  '/media/case-caseshow-57-66-gallery-2.webp',
  '/media/case-caseshow-57-66-gallery-3.webp',
  '/media/case-caseshow-57-61-hero.webp',
  '/media/case-caseshow-57-61-detail-hero.webp',
  '/media/case-caseshow-57-61-gallery-1.webp',
  '/media/case-caseshow-57-61-gallery-2.webp',
  '/media/case-caseshow-57-61-gallery-3.webp',
  '/media/case-caseshow-56-60-hero.webp',
  '/media/case-caseshow-56-60-detail-hero.webp',
  '/media/case-caseshow-56-60-gallery-1.webp',
  '/media/case-caseshow-56-60-gallery-2.webp',
  '/media/case-caseshow-56-60-gallery-3.webp',
  '/media/case-caseshow-56-59-hero.webp',
  '/media/case-caseshow-56-59-detail-hero.webp',
  '/media/case-caseshow-56-59-gallery-1.webp',
  '/media/case-caseshow-56-59-gallery-2.webp',
  '/media/case-caseshow-56-59-gallery-3.webp',
  '/media/case-caseshow-56-58-hero.webp',
  '/media/case-caseshow-56-58-detail-hero.webp',
  '/media/case-caseshow-56-58-gallery-1.webp',
  '/media/case-caseshow-56-58-gallery-2.webp',
  '/media/case-caseshow-56-58-gallery-3.webp',
  '/media/case-caseshow-53-77-hero.webp',
  '/media/case-caseshow-53-77-detail-hero.webp',
  '/media/case-caseshow-53-77-gallery-1.webp',
  '/media/case-caseshow-53-77-gallery-2.webp',
  '/media/case-caseshow-53-77-gallery-3.webp',
  '/media/case-caseshow-55-53-hero.webp',
  '/media/case-caseshow-55-53-detail-hero.webp',
  '/media/case-caseshow-55-53-gallery-1.webp',
  '/media/case-caseshow-55-53-gallery-2.webp',
  '/media/case-caseshow-55-53-gallery-3.webp',
  '/media/case-caseshow-53-76-hero.webp',
  '/media/case-caseshow-53-76-detail-hero.webp',
  '/media/case-caseshow-53-76-gallery-1.webp',
  '/media/case-caseshow-53-76-gallery-2.webp',
  '/media/case-caseshow-53-76-gallery-3.webp',
  '/media/case-shanxi-hero.png',
  '/media/case-shanxi-angle-wide.png',
  '/media/case-shanxi-angle-shaft.png',
  '/media/case-shanxi-angle-tunnel.png',
  '/media/case-shanxi-angle-low.png',
  '/media/case-shandong-police-hero.webp',
  '/media/case-shandong-police-gallery-1.webp',
  '/media/case-shandong-police-gallery-2.webp',
  '/media/case-shandong-police-gallery-3.webp',
  '/media/case-shandong-police-gallery-4.webp',
  '/media/case-zhejiang-outdoor-hero.webp',
  '/media/case-zhejiang-outdoor-gallery-1.webp',
  '/media/case-zhejiang-outdoor-gallery-2.webp',
  '/media/case-zhejiang-outdoor-gallery-3.webp',
  '/media/case-zhejiang-outdoor-gallery-4.webp',
  '/media/ft-overview-detail.png',
  '/media/ft-path-custom.png',
  '/media/ft-path-standard.png',
  '/media/gongan.png',
  '/media/hero.mp4',
  '/media/louisville-case.mp4',
  '/media/maritime-jacksonville.jpg',
  '/media/maritime-miami.jpg',
  '/media/mission.mp4',
  '/media/modular-construction.jpg',
  '/media/modular-d.png',
  '/media/modular-hero.jpg',
  '/media/modular-m.jpg',
  '/media/modular-o.png',
  '/media/modular-tower.mp4',
  '/media/modular-x.png',
  '/media/tower-chino.jpg',
  '/media/tower-ocean-springs.jpg',
  '/media/tower-prairieville.jpg',
  '/media/whp-hero.mp4',
  '/media/why.mp4',
  '/media/about-cn.webp',
  '/og-default.jpg',
  '/content/wechat.jpg',
  '/content/douyin.jpg',
] as const;

/** 展会种子默认封面（与 API TRADE_SHOW_COVERS 顺序对应）。 */
export const TRADE_SHOW_COVERS = [
  '/media/fixed-tower-hero.jpg',
  '/media/modular-hero.jpg',
  '/media/burn-room.webp',
  '/media/tactical.jpg',
] as const;

const SECTION_MEDIA_PATHS = [
  '/media/hero.mp4',
  '/media/fixed-tower-hero.jpg',
  '/media/mission.mp4',
  '/media/modular-construction.jpg',
] as const;

const QUICK_LINK_IMAGES = [
  '/media/fixed-tower-hero.jpg',
  '/media/modular-hero.jpg',
  '/media/burn-room.webp',
  '/media/tactical.jpg',
] as const;

export function isSiteStaticMediaPath(url: string): boolean {
  return url.startsWith('/media/') || /^\/og-/.test(url) || url.startsWith('/content/');
}

/** 收集站点引用的全部静态媒体路径，供 MinIO 同步脚本使用。 */
export function collectSiteStaticMediaPaths(): string[] {
  const set = new Set<string>([
    ...EXTRA_SITE_MEDIA_PATHS,
    ...TRADE_SHOW_COVERS,
    ...SECTION_MEDIA_PATHS,
    ...QUICK_LINK_IMAGES,
  ]);

  const add = (value?: string | null) => {
    const trimmed = value?.trim();
    if (trimmed && isSiteStaticMediaPath(trimmed)) set.add(trimmed);
  };

  for (const item of caseStudies) add(item.image);
  for (const item of newsItems) add(item.image);
  for (const item of blogPosts) add(item.image);
  for (const line of PRODUCT_LINES) add(line.image);
  for (const meta of SOLUTION_META) add(meta.image);

  return [...set].sort();
}
