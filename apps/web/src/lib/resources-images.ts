/**
 * 「资源与服务」模块图片注册表（单一数据源）。
 *
 * 页面不再散落图片常量，统一从这里取用；
 * 路径均走 `/media/*` → `resolveMediaUrl` 自动映射 MinIO/OSS `content/resources/*`。
 */

export const RESOURCES_IMAGES = {
  hub: {
    /** /resources hub 页专属 OG（训练基地全景） */
    og: '/media/resources/hub-og.webp',
  },
  'how-to-buy': {
    /** 交付/吊装场景 hero */
    hero: '/media/resources/how-to-buy-hero.webp',
    /** hub 卡片缩略图（16:10） */
    card: '/media/resources/how-to-buy-card.webp',
    og: '/media/resources/how-to-buy-og.webp',
    detailImages: [
      '/media/resources/how-to-buy-detail-1.webp',
      '/media/resources/how-to-buy-detail-2.webp',
    ],
  },
  'design-center': {
    /** 设计资料/图纸场景 hero */
    hero: '/media/resources/design-center-hero.webp',
    card: '/media/resources/design-center-card.webp',
    og: '/media/resources/design-center-og.webp',
  },
  inspections: {
    /** 检测员塔上作业场景 hero */
    hero: '/media/resources/inspections-hero.webp',
    card: '/media/resources/inspections-card.webp',
    og: '/media/resources/inspections-og.webp',
    detailImages: [
      '/media/resources/inspections-detail-1.webp',
      '/media/resources/inspections-detail-2.webp',
    ],
  },
  faqs: {
    /** 问答页轻量视觉（正文不加图，保持可读性） */
    card: '/media/resources/faqs-card.webp',
    og: '/media/resources/faqs-og.webp',
  },
  warranty: {
    /** 售后维保场景 hero */
    hero: '/media/resources/warranty-hero.webp',
    card: '/media/resources/warranty-card.webp',
    og: '/media/resources/warranty-og.webp',
    detailImages: [
      '/media/resources/warranty-detail-1.webp',
      '/media/resources/warranty-detail-2.webp',
    ],
  },
} as const;

/** hub 卡片缩略图：服务入口 href → 缩略图（内容中心入口不配，沿用图标）。 */
export const RESOURCES_CARD_BY_HREF: Record<string, string | undefined> = {
  '/resources/how-to-buy': RESOURCES_IMAGES['how-to-buy'].card,
  '/resources/design-center': RESOURCES_IMAGES['design-center'].card,
  '/resources/inspections': RESOURCES_IMAGES.inspections.card,
  '/resources/faqs': RESOURCES_IMAGES.faqs.card,
  '/resources/warranty': RESOURCES_IMAGES.warranty.card,
};
