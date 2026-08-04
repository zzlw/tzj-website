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
  '/media/case-gd-hero.png',
  '/media/case-gd-angle-wide.png',
  '/media/case-gd-angle-tower.png',
  '/media/case-gd-angle-burn.png',
  '/media/case-gd-angle-low.png',
  '/media/case-gd-interior.png',
  '/media/case-gd-lining.png',
  '/media/case-js-hero.png',
  '/media/case-js-angle-wide.png',
  '/media/case-js-angle-stair.png',
  '/media/case-js-angle-yard.png',
  '/media/case-js-angle-low.png',
  '/media/case-js-platform.png',
  '/media/case-js-module.png',
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
