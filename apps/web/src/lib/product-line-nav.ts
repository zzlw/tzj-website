/**
 * 产品线落地页二级导航 —— 与 product-catalog 互补：
 * 主导航展示 13 线；此处展示各产品线 hub 内的子页面（系列/定制/对比等）。
 */

export type ProductLineNavTab = {
  /** i18n nav.{key} */
  key: string;
  href: string;
  /** hub 页需精确匹配，避免 /fixed-tower/climbing-tower 误激活「概览」 */
  exact?: boolean;
};

export type ProductLineNavConfig = {
  /** 路径前缀，如 /fixed-tower */
  basePath: string;
  /** 所属产品线 catalog id（用于展示编号） */
  lineId: string;
  tabs: ProductLineNavTab[];
  /** 同族/关联产品线（如攀登楼、CFBT） */
  related?: ProductLineNavTab[];
  /** 不匹配此导航的完整路径（如 accessories 下的专项线独立页） */
  excludeExact?: string[];
};

/** 多子页产品 hub */
export const PRODUCT_LINE_NAV_CONFIGS: ProductLineNavConfig[] = [
  {
    basePath: '/fixed-tower',
    lineId: 'fixed-tower',
    tabs: [
      { key: 'fixedTowerOverview', href: '/fixed-tower', exact: true },
      { key: 'fixedTowerSeries', href: '/fixed-tower/series' },
      { key: 'fixedTowerCustom', href: '/fixed-tower/custom' },
    ],
    related: [{ key: 'productLine03', href: '/fixed-tower/climbing-tower' }],
  },
  {
    basePath: '/modular-tower',
    lineId: 'modular-tower',
    tabs: [
      { key: 'modularTowerOverview', href: '/modular-tower', exact: true },
      { key: 'modularTowerSeries', href: '/modular-tower/series' },
      { key: 'modularTowerVsContainers', href: '/modular-tower/vs-containers' },
      { key: 'modularTowerCustom', href: '/modular-tower/custom' },
    ],
  },
  {
    basePath: '/burn-rooms',
    lineId: 'burn-rooms',
    tabs: [
      { key: 'burnRoomsOverview', href: '/burn-rooms', exact: true },
      { key: 'burnRoomsLiner', href: '/burn-rooms/liner' },
      { key: 'burnRoomsComparison', href: '/burn-rooms/comparison' },
    ],
    related: [
      { key: 'productLine06', href: '/burn-rooms/cfbt' },
      { key: 'productLine07', href: '/burn-rooms/fire-simulation' },
    ],
  },
  {
    basePath: '/accessories',
    lineId: 'accessories',
    excludeExact: ['/accessories/maritime', '/accessories/tactical', '/accessories/hazmat'],
    tabs: [
      { key: 'accessoriesOverview', href: '/accessories', exact: true },
      { key: 'accessoriesFitness', href: '/accessories/fitness-equipment' },
      { key: 'accessoriesCompetition', href: '/accessories/competition' },
    ],
  },
];

/** 单页产品线 —— 仅展示产品线标识 + 关联合集 */
export const PRODUCT_LINE_SINGLE_CONFIGS: ProductLineNavConfig[] = [
  {
    basePath: '/fixed-tower/climbing-tower',
    lineId: 'climbing-tower',
    tabs: [{ key: 'productLine03', href: '/fixed-tower/climbing-tower', exact: true }],
    related: [
      { key: 'productLine01', href: '/fixed-tower' },
      { key: 'productLine02', href: '/modular-tower' },
    ],
  },
  {
    basePath: '/education-center',
    lineId: 'education-center',
    tabs: [{ key: 'productLine04', href: '/education-center', exact: true }],
    related: [
      { key: 'productLine01', href: '/fixed-tower' },
      { key: 'productLine02', href: '/modular-tower' },
    ],
  },
  {
    basePath: '/accessories/maritime',
    lineId: 'maritime',
    tabs: [{ key: 'productLine08', href: '/accessories/maritime', exact: true }],
    related: [
      { key: 'productLine09', href: '/accessories/tactical' },
      { key: 'productLine10', href: '/accessories/hazmat' },
    ],
  },
  {
    basePath: '/accessories/tactical',
    lineId: 'tactical',
    tabs: [{ key: 'productLine09', href: '/accessories/tactical', exact: true }],
    related: [
      { key: 'productLine08', href: '/accessories/maritime' },
      { key: 'productLine10', href: '/accessories/hazmat' },
    ],
  },
  {
    basePath: '/accessories/hazmat',
    lineId: 'hazmat',
    tabs: [{ key: 'productLine10', href: '/accessories/hazmat', exact: true }],
    related: [
      { key: 'productLine08', href: '/accessories/maritime' },
      { key: 'productLine09', href: '/accessories/tactical' },
    ],
  },
  {
    basePath: '/specialized-training/rope-rescue',
    lineId: 'rope-rescue',
    tabs: [{ key: 'productLine11', href: '/specialized-training/rope-rescue', exact: true }],
    related: [{ key: 'productLine12', href: '/specialized-training/psychological' }],
  },
  {
    basePath: '/specialized-training/psychological',
    lineId: 'psychological',
    tabs: [{ key: 'productLine12', href: '/specialized-training/psychological', exact: true }],
    related: [{ key: 'productLine11', href: '/specialized-training/rope-rescue' }],
  },
];

const ALL_CONFIGS = [...PRODUCT_LINE_SINGLE_CONFIGS, ...PRODUCT_LINE_NAV_CONFIGS];

function normalizePath(pathname: string): string {
  const path = pathname.split('#')[0]!.split('?')[0]!;
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

function matchesTab(pathname: string, tab: ProductLineNavTab): boolean {
  if (tab.exact) return pathname === tab.href;
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function resolveProductLineNav(pathname: string | null): ProductLineNavConfig | null {
  if (!pathname) return null;
  const path = normalizePath(pathname);

  for (const config of ALL_CONFIGS) {
    if (config.excludeExact?.includes(path)) continue;
    if (path === config.basePath || path.startsWith(`${config.basePath}/`)) {
      if (config.excludeExact?.some((ex) => path === ex || path.startsWith(`${ex}/`))) {
        continue;
      }
      return config;
    }
  }
  return null;
}

export function isTabActive(pathname: string, tab: ProductLineNavTab): boolean {
  return matchesTab(normalizePath(pathname), tab);
}

export function isRelatedActive(pathname: string, tab: ProductLineNavTab): boolean {
  const path = normalizePath(pathname);
  return path === tab.href || path.startsWith(`${tab.href}/`);
}
