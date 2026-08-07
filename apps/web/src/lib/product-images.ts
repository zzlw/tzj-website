/** 非 ProductLine 主键的产品子页 / 对比页主图注册表 */

export type ProductPageImages = {
  heroImage: string;
  ogImage?: string;
  detailImages?: string[];
  featureImages?: Record<string, string>;
  configImage?: string;
  extraImage?: string;
  usersImage?: string;
  relatedCaseSlugs?: string[];
};

const media = (family: string, name: string) => `/media/product/${family}/${name}`;

export const PRODUCT_PAGE_IMAGES: Record<string, ProductPageImages> = {
  'accessories-fitness': {
    heroImage: media('accessories', 'fitness-hero.webp'),
    ogImage: media('accessories', 'fitness-og.webp'),
    detailImages: [
      media('accessories', 'fitness-detail-1.webp'),
      media('accessories', 'fitness-detail-2.webp'),
      media('accessories', 'fitness-detail-3.webp'),
    ],
    featureImages: {
      strength: media('accessories', 'fitness-feature-strength.webp'),
      vestibular: media('accessories', 'fitness-feature-vestibular.webp'),
      balance: media('accessories', 'fitness-feature-balance.webp'),
      cardio: media('accessories', 'fitness-feature-cardio.webp'),
      adjustable: media('accessories', 'fitness-feature-adjustable.webp'),
      durable: media('accessories', 'fitness-feature-durable.webp'),
    },
    configImage: media('accessories', 'fitness-config.webp'),
    extraImage: media('accessories', 'fitness-extra.webp'),
    usersImage: media('accessories', 'fitness-users.webp'),
  },
  'accessories-competition': {
    heroImage: media('accessories', 'competition-hero.webp'),
    ogImage: media('accessories', 'competition-og.webp'),
    detailImages: [
      media('accessories', 'competition-detail-1.webp'),
      media('accessories', 'competition-detail-2.webp'),
      media('accessories', 'competition-detail-3.webp'),
    ],
    featureImages: {
      standards: media('accessories', 'competition-feature-standards.webp'),
      timing: media('accessories', 'competition-feature-timing.webp'),
      training: media('accessories', 'competition-feature-training.webp'),
      drills: media('accessories', 'competition-feature-drills.webp'),
      levels: media('accessories', 'competition-feature-levels.webp'),
      durable: media('accessories', 'competition-feature-durable.webp'),
    },
    configImage: media('accessories', 'competition-config.webp'),
    extraImage: media('accessories', 'competition-extra.webp'),
    usersImage: media('accessories', 'competition-users.webp'),
  },
  'burn-hub': {
    heroImage: media('burn', 'hub-hero.webp'),
    ogImage: media('burn', 'hub-og.webp'),
  },
  'burn-comparison': {
    heroImage: media('burn', 'comparison-hero.webp'),
    ogImage: media('burn', 'comparison-og.webp'),
  },
  'fixed-series': {
    heroImage: media('towers', 'fixed-series-hero.webp'),
    ogImage: media('towers', 'fixed-series-og.webp'),
    detailImages: [
      media('towers', 'fixed-series-structure-1.webp'),
      media('towers', 'fixed-series-structure-2.webp'),
    ],
  },
  'fixed-custom': {
    heroImage: media('towers', 'fixed-custom-hero.webp'),
    ogImage: media('towers', 'fixed-custom-og.webp'),
    detailImages: [
      media('towers', 'fixed-custom-structure-1.webp'),
      media('towers', 'fixed-custom-structure-2.webp'),
    ],
  },
  'modular-series': {
    heroImage: media('towers', 'modular-series-hero.webp'),
    ogImage: media('towers', 'modular-series-og.webp'),
    featureImages: {
      m: media('towers', 'modular-series-m.webp'),
      o: media('towers', 'modular-series-o.webp'),
      d: media('towers', 'modular-series-d.webp'),
      x: media('towers', 'modular-series-x.webp'),
    },
  },
  'modular-custom': {
    heroImage: media('towers', 'modular-custom-hero.webp'),
    ogImage: media('towers', 'modular-custom-og.webp'),
    detailImages: [
      media('towers', 'modular-custom-structure-1.webp'),
      media('towers', 'modular-custom-structure-2.webp'),
    ],
  },
  'modular-vs-containers': {
    heroImage: media('towers', 'vs-containers-hero.webp'),
    ogImage: media('towers', 'vs-containers-og.webp'),
  },
  'towers-hub': {
    heroImage: media('towers', 'hub-hero.webp'),
    ogImage: media('towers', 'hub-og.webp'),
  },
  'specialized-hub': {
    heroImage: media('specialized', 'hub-hero.webp'),
    ogImage: media('specialized', 'hub-og.webp'),
  },
};

export function getProductPageImages(id: string): ProductPageImages {
  const imgs = PRODUCT_PAGE_IMAGES[id];
  if (!imgs) throw new Error(`missing product page images: ${id}`);
  return imgs;
}

/** 子 SKU / hub / 对比页路由 → 卡片封面回退图（RelatedLinks 等按 href 取图时使用） */
export const SUBPAGE_COVER_BY_HREF: Record<string, string> = {
  '/accessories/fitness-equipment': media('accessories', 'fitness-hero.webp'),
  '/accessories/competition': media('accessories', 'competition-hero.webp'),
  '/burn-rooms': media('burn', 'hub-hero.webp'),
  '/burn-rooms/comparison': media('burn', 'comparison-hero.webp'),
  '/fixed-tower/custom': media('towers', 'fixed-custom-hero.webp'),
  '/fixed-tower/series': media('towers', 'fixed-series-hero.webp'),
  '/modular-tower/series': media('towers', 'modular-series-hero.webp'),
  '/modular-tower/vs-containers': media('towers', 'vs-containers-hero.webp'),
  '/specialized-training': media('specialized', 'hub-hero.webp'),
};

export function subpageCoverByHref(href: string): string | undefined {
  return SUBPAGE_COVER_BY_HREF[href];
}
