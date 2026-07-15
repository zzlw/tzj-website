/**
 * 站点静态媒体 Web 路径清单（常量部分）。
 * 与 apps/web/src/lib/static-media-paths.ts 保持同步；
 * content/ 目录素材已整目录保护，此处覆盖根目录资源等非 content 引用。
 */
const EXTRA_SITE_MEDIA_PATHS = [
  '/media/alarm-1st.png',
  '/media/alarm-3rd.png',
  '/media/alarm-5th.png',
  '/media/alarm-highrise.jpg',
  '/media/burn-room.mp4',
  '/media/fixed-series.mp4',
  '/media/fixed-tower-hero.jpg',
  '/media/fixed-tower.mp4',
  '/media/hero.mp4',
  '/media/louisville-case.mp4',
  '/media/maritime-jacksonville.jpg',
  '/media/maritime-miami.jpg',
  '/media/mission.mp4',
  '/media/modular-d.png',
  '/media/modular-m.jpg',
  '/media/modular-o.png',
  '/media/modular-tower.mp4',
  '/media/modular-x.png',
  '/media/tower-ocean-springs.jpg',
  '/media/tower-prairieville.jpg',
  '/media/whp-hero.mp4',
  '/media/why.mp4',
  '/og-default.jpg',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/content/wechat.jpg',
  '/content/douyin.jpg',
] as const;

const TRADE_SHOW_COVERS = [
  '/media/tower-wylie.jpg',
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

export function collectSiteStaticMediaPaths(): string[] {
  return [
    ...new Set([
      ...EXTRA_SITE_MEDIA_PATHS,
      ...TRADE_SHOW_COVERS,
      ...SECTION_MEDIA_PATHS,
      ...QUICK_LINK_IMAGES,
    ]),
  ].sort();
}
