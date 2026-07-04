/** kebab-case 文件名 → camelCase 命名空间键，如 fixed-tower-custom → fixedTowerCustom */
export function kebabToCamelCase(id: string): string {
  return id.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** 路由路径 → pages 下的 JSON 文件名（kebab-case）。 */
export function pageContentIdFromPath(routePath: string): string {
  return routePath.replace(/^\//, "").replace(/\//g, "-") || "home";
}

/** 所有静态页 JSON 文件名（与 messages/{locale}/pages/*.json 对应）。 */
export const PAGE_IDS = [
  "fixed-tower",
  "fixed-tower-custom",
  "fixed-tower-series",
  "fixed-tower-climbing-tower",
  "modular-tower",
  "modular-tower-series",
  "modular-tower-custom",
  "modular-tower-vs-containers",
  "burn-rooms",
  "burn-rooms-liner",
  "burn-rooms-cfbt",
  "burn-rooms-fire-simulation",
  "burn-rooms-comparison",
  "accessories",
  "accessories-hazmat",
  "accessories-maritime",
  "accessories-tactical",
  "accessories-competition",
  "accessories-fitness-equipment",
  "specialized-training",
  "specialized-training-psychological",
  "specialized-training-rope-rescue",
  "why-us",
  "why-us-story",
  "why-us-team",
  "why-us-certification",
  "why-us-global",
  "resources",
  "resources-blog",
  "resources-news",
  "resources-trade-shows",
  "resources-design-center",
  "resources-inspections",
  "resources-faqs",
  "resources-how-to-buy",
  "resources-warranty",
  "solutions",
  "solution-detail",
  "towers",
  "education-center",
  "cases",
  "privacy",
  "terms",
] as const;

export type PageId = (typeof PAGE_IDS)[number];
