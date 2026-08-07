/** 「为什么选我们」图片注册表 — 5 个路由的单一数据源。
 *  OSS/MinIO key：`content/why-us/{name}.webp`（resolveMediaUrl 自动映射 /media/why-us/*）。
 */

export const WHY_US_IMAGES = {
  overview: {
    hero: '/media/why-us/overview-hero.webp',
    og: '/media/why-us/overview-og.webp',
    /** 三大支柱/使命愿景区块配图（交付安装现场） */
    pillars: '/media/why-us/overview-pillars.webp',
  },
  story: {
    hero: '/media/why-us/story-hero.webp',
    og: '/media/why-us/story-og.webp',
    /** 时间线里程碑配图：工厂产线 */
    milestoneFactory: '/media/why-us/story-milestone-factory.webp',
    /** 时间线里程碑配图：交付发运 */
    milestoneDelivery: '/media/why-us/story-milestone-delivery.webp',
  },
  team: {
    hero: '/media/why-us/team-hero.webp',
    og: '/media/why-us/team-og.webp',
    /** 团队协作场景（无 AI 人像，背影/过肩视角） */
    collab: '/media/why-us/team-collab.webp',
  },
  certification: {
    hero: '/media/why-us/certification-hero.webp',
    og: '/media/why-us/certification-og.webp',
  },
  global: {
    hero: '/media/why-us/global-hero.webp',
    og: '/media/why-us/global-og.webp',
  },
} as const;

/** why-us 子路由 → 封面图（RelatedLinks 等按 href 取图时使用）。 */
export const WHY_US_COVER_BY_HREF: Record<string, string> = {
  '/why-us': WHY_US_IMAGES.overview.hero,
  '/why-us/story': WHY_US_IMAGES.story.hero,
  '/why-us/team': WHY_US_IMAGES.team.hero,
  '/why-us/certification': WHY_US_IMAGES.certification.hero,
  '/why-us/global': WHY_US_IMAGES.global.hero,
};

export function whyUsCoverByHref(href: string): string | undefined {
  return WHY_US_COVER_BY_HREF[href];
}
