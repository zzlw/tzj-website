/** 产品中心 — 四大板块 · 十三大产品线（站点单一数据源） */

export const PRODUCT_LINE_COUNT = 13;

export type ProductFamilyId = 'towers' | 'burn' | 'specialized' | 'accessories';

export type ProductFamily = {
  id: ProductFamilyId;
  /** i18n nav.{navKey} */
  navKey: string;
  title: string;
  description: string;
};

export type ProductLine = {
  id: string;
  index: number;
  anchor: string;
  /** i18n nav.{navKey} */
  navKey: string;
  /** 吸顶导航等窄空间使用的短标题 */
  shortTitle: string;
  title: string;
  href: string;
  /** 4:3 产品线卡片图（列表/导航） */
  image: string;
  /** 16:9 页面主视觉；未设置时回退 image */
  heroImage?: string;
  /** OG/Twitter 图；未设置时回退 heroImage ?? image */
  ogImage?: string;
  /** 页面结构/场景细节图 */
  detailImages?: string[];
  /** 能力/场景矩阵：featureId → 图片路径 */
  featureImages?: Record<string, string>;
  /** 典型配置示意 */
  configImage?: string;
  /** 「更多道具」等补充区块集合图 */
  extraImage?: string;
  /** 「适用单位」建立感图 */
  usersImage?: string;
  /** 交钥匙 ProcessBand 覆盖图；未设时用全站 shared/process-turnkey */
  processImage?: string;
  /** 关联案例 slug；空/未设则页面不渲染案例区 */
  relatedCaseSlugs?: string[];
  description: string;
  family: ProductFamilyId;
  subLinks?: { title: string; href: string; navKey?: string }[];
};

export function getProductLine(id: string): ProductLine | undefined {
  return PRODUCT_LINES.find((line) => line.id === id);
}

export function productLineByHref(href: string): ProductLine | undefined {
  return PRODUCT_LINES.find((line) => line.href === href);
}

export function productLineHeroImage(line: ProductLine): string {
  return line.heroImage ?? line.image;
}

export function productLineOgImage(line: ProductLine): string {
  return line.ogImage ?? line.heroImage ?? line.image;
}

export const PRODUCT_FAMILIES: ProductFamily[] = [
  {
    id: 'towers',
    navKey: 'productFamilyTowers',
    title: '训练塔与建筑',
    description: '工业级钢结构建筑主体 —— 从多层实战火场到攀登楼与科普馆，为训练基地奠定坚固骨架。',
  },
  {
    id: 'burn',
    navKey: 'productFamilyBurn',
    title: '实火与燃烧训练',
    description:
      '安全可控的真实火场与烟火特性训练 —— 互锁衬里、CFBT 与消防模拟，支撑高强度实战演练。',
  },
  {
    id: 'specialized',
    navKey: 'productFamilySpecialized',
    title: '专项场景训练',
    description:
      '面向特定任务的高度专业化场景 —— 海事、战术、危化品、绳索与心理拓展，贴近真实、可反复演练。',
  },
  {
    id: 'accessories',
    navKey: 'productFamilyAccessories',
    title: '训练器械与道具',
    description: '配件道具、体能器械与竞赛设施 —— 完善从体能到实战的训练闭环。',
  },
];

export const PRODUCT_LINES: ProductLine[] = [
  // A. 训练塔与建筑（4）
  {
    id: 'fixed-tower',
    index: 1,
    anchor: 'line-01',
    navKey: 'productLine01',
    shortTitle: '固定训练塔',
    title: '固定训练塔（钢结构）',
    href: '/fixed-tower',
    image: '/media/product/towers/fixed-card.webp',
    heroImage: '/media/product/towers/fixed-hero.webp',
    ogImage: '/media/product/towers/fixed-og.webp',
    detailImages: [
      '/media/product/towers/fixed-detail-1.webp',
      '/media/product/towers/fixed-detail-2.webp',
      '/media/product/towers/fixed-detail-3.webp',
    ],
    featureImages: {
      galvanized: '/media/product/towers/fixed-feature-galvanized.webp',
      multilevel: '/media/product/towers/fixed-feature-multilevel.webp',
      windows: '/media/product/towers/fixed-feature-windows.webp',
      stairs: '/media/product/towers/fixed-feature-stairs.webp',
      props: '/media/product/towers/fixed-feature-props.webp',
      durable: '/media/product/towers/fixed-feature-durable.webp',
    },
    configImage: '/media/product/towers/fixed-config.webp',
    extraImage: '/media/product/towers/fixed-extra.webp',
    usersImage: '/media/product/towers/fixed-users.webp',
    relatedCaseSlugs: ['henan-fire-rescue', 'guangdong-cfbt', 'jiangsu-university'],
    description: '工业级全镀锌钢结构，标准与定制，面向多层实战火场训练主体。',
    family: 'towers',
  },
  {
    id: 'modular-tower',
    index: 2,
    anchor: 'line-02',
    navKey: 'productLine02',
    shortTitle: '模块化塔',
    title: '模块化训练塔',
    href: '/modular-tower',
    image: '/media/product/towers/modular-card.webp',
    heroImage: '/media/product/towers/modular-hero.webp',
    ogImage: '/media/product/towers/modular-og.webp',
    detailImages: [
      '/media/product/towers/modular-detail-1.webp',
      '/media/product/towers/modular-detail-2.webp',
      '/media/product/towers/modular-detail-3.webp',
    ],
    featureImages: {
      openplan: '/media/product/towers/modular-feature-openplan.webp',
      reconfigure: '/media/product/towers/modular-feature-reconfigure.webp',
      expand: '/media/product/towers/modular-feature-expand.webp',
      nointernal: '/media/product/towers/modular-feature-nointernal.webp',
      install: '/media/product/towers/modular-feature-install.webp',
      upgrade: '/media/product/towers/modular-feature-upgrade.webp',
    },
    configImage: '/media/product/towers/modular-config.webp',
    extraImage: '/media/product/towers/modular-extra.webp',
    usersImage: '/media/product/towers/modular-users.webp',
    relatedCaseSlugs: [],
    description: '开放式平面、无内部承重墙，墙门窗自由重组，支持分期扩建与能力升级。',
    family: 'towers',
  },
  {
    id: 'climbing-tower',
    index: 3,
    anchor: 'line-03',
    navKey: 'productLine03',
    shortTitle: '攀登楼',
    title: '公安武警攀登楼',
    href: '/fixed-tower/climbing-tower',
    image: '/media/product/towers/climbing-card.webp',
    heroImage: '/media/product/towers/climbing-hero.webp',
    ogImage: '/media/product/towers/climbing-og.webp',
    detailImages: [
      '/media/product/towers/climbing-detail-1.webp',
      '/media/product/towers/climbing-detail-2.webp',
      '/media/product/towers/climbing-detail-3.webp',
    ],
    featureImages: {
      multilevel: '/media/product/towers/climbing-feature-multilevel.webp',
      rappel: '/media/product/towers/climbing-feature-rappel.webp',
      breach: '/media/product/towers/climbing-feature-breach.webp',
      layout: '/media/product/towers/climbing-feature-layout.webp',
      teamwork: '/media/product/towers/climbing-feature-teamwork.webp',
      durable: '/media/product/towers/climbing-feature-durable.webp',
    },
    configImage: '/media/product/towers/climbing-config.webp',
    extraImage: '/media/product/towers/climbing-extra.webp',
    usersImage: '/media/product/towers/climbing-users.webp',
    relatedCaseSlugs: ['shandong-police', 'caseshow-54-47'],
    description: '面向公安、特警与武警的攀登楼主体，将攀登、索降与战术突入融入结构设计。',
    family: 'towers',
  },
  {
    id: 'education-center',
    index: 4,
    anchor: 'line-04',
    navKey: 'productLine04',
    shortTitle: '科普教育馆',
    title: '科普教育馆',
    href: '/education-center',
    image: '/media/product/towers/education-card.webp',
    heroImage: '/media/product/towers/education-hero.webp',
    ogImage: '/media/product/towers/education-og.webp',
    detailImages: [
      '/media/product/towers/education-detail-1.webp',
      '/media/product/towers/education-detail-2.webp',
      '/media/product/towers/education-detail-3.webp',
    ],
    featureImages: {
      immersive: '/media/product/towers/education-feature-immersive.webp',
      zones: '/media/product/towers/education-feature-zones.webp',
      audience: '/media/product/towers/education-feature-audience.webp',
      safe: '/media/product/towers/education-feature-safe.webp',
      digital: '/media/product/towers/education-feature-digital.webp',
      train: '/media/product/towers/education-feature-train.webp',
    },
    configImage: '/media/product/towers/education-config.webp',
    extraImage: '/media/product/towers/education-extra.webp',
    usersImage: '/media/product/towers/education-users.webp',
    relatedCaseSlugs: ['jiangsu-university'],
    description: '沉浸式消防安全科普体验空间，服务院校教学与公众安全教育，寓教于练。',
    family: 'towers',
  },
  // B. 实火与燃烧训练（3）
  {
    id: 'burn-rooms',
    index: 5,
    anchor: 'line-05',
    navKey: 'productLine05',
    shortTitle: '燃烧室',
    title: '燃烧室 · 互锁衬里',
    href: '/burn-rooms/liner',
    image: '/media/product/burn/liner-card.webp',
    heroImage: '/media/product/burn/liner-hero.webp',
    ogImage: '/media/product/burn/liner-og.webp',
    detailImages: [
      '/media/product/burn/liner-detail-1.webp',
      '/media/product/burn/liner-detail-2.webp',
      '/media/product/burn/liner-detail-3.webp',
    ],
    featureImages: {
      interlock: '/media/product/burn/liner-feature-interlock.webp',
      hightemp: '/media/product/burn/liner-feature-hightemp.webp',
      inspect: '/media/product/burn/liner-feature-inspect.webp',
      replace: '/media/product/burn/liner-feature-replace.webp',
      modular: '/media/product/burn/liner-feature-modular.webp',
      nfpa: '/media/product/burn/liner-feature-nfpa.webp',
    },
    configImage: '/media/product/burn/liner-config.webp',
    extraImage: '/media/product/burn/liner-extra.webp',
    usersImage: '/media/product/burn/liner-users.webp',
    relatedCaseSlugs: ['guangdong-cfbt', 'henan-fire-rescue'],
    description: '钙硅基互锁隔热衬里，耐高温、低维护，为安全逼真的实战火场训练保驾护航。',
    family: 'burn',
  },
  {
    id: 'cfbt',
    index: 6,
    anchor: 'line-06',
    navKey: 'productLine06',
    shortTitle: 'CFBT',
    title: 'CFBT 烟火特性训练',
    href: '/burn-rooms/cfbt',
    image: '/media/product/burn/cfbt-card.webp',
    heroImage: '/media/product/burn/cfbt-hero.webp',
    ogImage: '/media/product/burn/cfbt-og.webp',
    detailImages: [
      '/media/product/burn/cfbt-detail-1.webp',
      '/media/product/burn/cfbt-detail-2.webp',
      '/media/product/burn/cfbt-detail-3.webp',
    ],
    featureImages: {
      smoke: '/media/product/burn/cfbt-feature-smoke.webp',
      heat: '/media/product/burn/cfbt-feature-heat.webp',
      flashover: '/media/product/burn/cfbt-feature-flashover.webp',
      tactics: '/media/product/burn/cfbt-feature-tactics.webp',
      observe: '/media/product/burn/cfbt-feature-observe.webp',
      safety: '/media/product/burn/cfbt-feature-safety.webp',
    },
    configImage: '/media/product/burn/cfbt-config.webp',
    extraImage: '/media/product/burn/cfbt-extra.webp',
    usersImage: '/media/product/burn/cfbt-users.webp',
    relatedCaseSlugs: ['guangdong-cfbt'],
    description: '烟火特性认知与控火训练设施，帮助学员理解火场发展规律与战术决策。',
    family: 'burn',
  },
  {
    id: 'fire-simulation',
    index: 7,
    anchor: 'line-07',
    navKey: 'productLine07',
    shortTitle: '消防模拟',
    title: '消防模拟训练设施',
    href: '/burn-rooms/fire-simulation',
    image: '/media/product/burn/fire-simulation-card.webp',
    heroImage: '/media/product/burn/fire-simulation-hero.webp',
    ogImage: '/media/product/burn/fire-simulation-og.webp',
    detailImages: [
      '/media/product/burn/fire-simulation-detail-1.webp',
      '/media/product/burn/fire-simulation-detail-2.webp',
      '/media/product/burn/fire-simulation-detail-3.webp',
    ],
    featureImages: {
      smoke: '/media/product/burn/fire-simulation-feature-smoke.webp',
      heat: '/media/product/burn/fire-simulation-feature-heat.webp',
      alarm: '/media/product/burn/fire-simulation-feature-alarm.webp',
      program: '/media/product/burn/fire-simulation-feature-program.webp',
      evacuate: '/media/product/burn/fire-simulation-feature-evacuate.webp',
      control: '/media/product/burn/fire-simulation-feature-control.webp',
    },
    configImage: '/media/product/burn/fire-simulation-config.webp',
    extraImage: '/media/product/burn/fire-simulation-extra.webp',
    usersImage: '/media/product/burn/fire-simulation-users.webp',
    relatedCaseSlugs: [],
    description: '可编程烟热与报警联动系统，在可控环境中复现复杂火场与疏散场景。',
    family: 'burn',
  },
  // C. 专项场景训练（5）
  {
    id: 'maritime',
    index: 8,
    anchor: 'line-08',
    navKey: 'productLine08',
    shortTitle: '海事训练',
    title: '海事训练设施',
    href: '/accessories/maritime',
    image: '/media/product/specialized/maritime-card.webp',
    heroImage: '/media/product/specialized/maritime-hero.webp',
    ogImage: '/media/product/specialized/maritime-og.webp',
    detailImages: [
      '/media/product/specialized/maritime-detail-1.webp',
      '/media/product/specialized/maritime-detail-2.webp',
      '/media/product/specialized/maritime-detail-3.webp',
    ],
    featureImages: {
      bridge: '/media/product/specialized/maritime-feature-bridge.webp',
      hatch: '/media/product/specialized/maritime-feature-hatch.webp',
      door: '/media/product/specialized/maritime-feature-door.webp',
      engine: '/media/product/specialized/maritime-feature-engine.webp',
      maze: '/media/product/specialized/maritime-feature-maze.webp',
      cargo: '/media/product/specialized/maritime-feature-cargo.webp',
    },
    configImage: '/media/product/specialized/maritime-config.webp',
    extraImage: '/media/product/specialized/maritime-extra.webp',
    usersImage: '/media/product/specialized/maritime-users.webp',
    // 案例中心暂无海事专项交付案例；有匹配后再填，空则不渲染案例区
    relatedCaseSlugs: [],
    description: '船舱、甲板与狭舱救援场景，还原真实水上火场与港口消防训练需求。',
    family: 'specialized',
  },
  {
    id: 'tactical',
    index: 9,
    anchor: 'line-09',
    navKey: 'productLine09',
    shortTitle: '战术训练',
    title: '战术训练设施',
    href: '/accessories/tactical',
    image: '/media/product/specialized/tactical-card.webp',
    heroImage: '/media/product/specialized/tactical-hero.webp',
    ogImage: '/media/product/specialized/tactical-og.webp',
    detailImages: [
      '/media/product/specialized/tactical-detail-1.webp',
      '/media/product/specialized/tactical-detail-2.webp',
      '/media/product/specialized/tactical-detail-3.webp',
    ],
    featureImages: {
      breach: '/media/product/specialized/tactical-feature-breach.webp',
      cqb: '/media/product/specialized/tactical-feature-cqb.webp',
      stairwell: '/media/product/specialized/tactical-feature-stairwell.webp',
      rope: '/media/product/specialized/tactical-feature-rope.webp',
    },
    configImage: '/media/product/specialized/tactical-config.webp',
    extraImage: '/media/product/specialized/tactical-extra.webp',
    usersImage: '/media/product/specialized/tactical-users.webp',
    relatedCaseSlugs: ['shandong-police', 'caseshow-54-47', 'caseshow-54-46'],
    description: '破门突入、CQB 与绳索高空等可重组战术场景，服务公安特警实战化演练。',
    family: 'specialized',
  },
  {
    id: 'hazmat',
    index: 10,
    anchor: 'line-10',
    navKey: 'productLine10',
    shortTitle: '危化品训练',
    title: '危化品训练设施',
    href: '/accessories/hazmat',
    image: '/media/product/specialized/hazmat-card.webp',
    heroImage: '/media/product/specialized/hazmat-hero.webp',
    ogImage: '/media/product/specialized/hazmat-og.webp',
    detailImages: [
      '/media/product/specialized/hazmat-detail-1.webp',
      '/media/product/specialized/hazmat-detail-2.webp',
      '/media/product/specialized/hazmat-detail-3.webp',
    ],
    featureImages: {
      chlorine: '/media/product/specialized/hazmat-feature-chlorine.webp',
      drum: '/media/product/specialized/hazmat-feature-drum.webp',
      tank: '/media/product/specialized/hazmat-feature-tank.webp',
      reaction: '/media/product/specialized/hazmat-feature-reaction.webp',
      falling: '/media/product/specialized/hazmat-feature-falling.webp',
      panel: '/media/product/specialized/hazmat-feature-panel.webp',
    },
    configImage: '/media/product/specialized/hazmat-config.webp',
    extraImage: '/media/product/specialized/hazmat-extra.webp',
    usersImage: '/media/product/specialized/hazmat-users.webp',
    relatedCaseSlugs: [],
    description: '泄漏、堵漏与洗消场景，支持跨区域协同演练与危化品应急处置训练。',
    family: 'specialized',
  },
  {
    id: 'rope-rescue',
    index: 11,
    anchor: 'line-11',
    navKey: 'productLine11',
    shortTitle: '绳索救援',
    title: '山岳绳索救援设施',
    href: '/specialized-training/rope-rescue',
    image: '/media/product/specialized/rope-rescue-card.webp',
    heroImage: '/media/product/specialized/rope-rescue-hero.webp',
    ogImage: '/media/product/specialized/rope-rescue-og.webp',
    detailImages: [
      '/media/product/specialized/rope-rescue-detail-1.webp',
      '/media/product/specialized/rope-rescue-detail-2.webp',
      '/media/product/specialized/rope-rescue-detail-3.webp',
    ],
    featureImages: {
      terrain: '/media/product/specialized/rope-rescue-feature-terrain.webp',
      vertical: '/media/product/specialized/rope-rescue-feature-vertical.webp',
      anchors: '/media/product/specialized/rope-rescue-feature-anchors.webp',
      stretcher: '/media/product/specialized/rope-rescue-feature-stretcher.webp',
      multipath: '/media/product/specialized/rope-rescue-feature-multipath.webp',
      safety: '/media/product/specialized/rope-rescue-feature-safety.webp',
    },
    configImage: '/media/product/specialized/rope-rescue-config.webp',
    extraImage: '/media/product/specialized/rope-rescue-extra.webp',
    usersImage: '/media/product/specialized/rope-rescue-users.webp',
    relatedCaseSlugs: ['shanxi-mine-rescue', 'zhejiang-outdoor', 'jiangsu-university'],
    description: '高空、崖壁与狭缝救援训练设施，支撑山岳与高空绳索救援科目。',
    family: 'specialized',
  },
  {
    id: 'psychological',
    index: 12,
    anchor: 'line-12',
    navKey: 'productLine12',
    shortTitle: '心理拓展',
    title: '心理拓展训练设施',
    href: '/specialized-training/psychological',
    image: '/media/product/specialized/psychological-card.webp',
    heroImage: '/media/product/specialized/psychological-hero.webp',
    ogImage: '/media/product/specialized/psychological-og.webp',
    detailImages: [
      '/media/product/specialized/psychological-detail-1.webp',
      '/media/product/specialized/psychological-detail-2.webp',
      '/media/product/specialized/psychological-detail-3.webp',
    ],
    featureImages: {
      highangle: '/media/product/specialized/psychological-feature-highangle.webp',
      willpower: '/media/product/specialized/psychological-feature-willpower.webp',
      teamwork: '/media/product/specialized/psychological-feature-teamwork.webp',
      stress: '/media/product/specialized/psychological-feature-stress.webp',
      levels: '/media/product/specialized/psychological-feature-levels.webp',
      safety: '/media/product/specialized/psychological-feature-safety.webp',
    },
    configImage: '/media/product/specialized/psychological-config.webp',
    extraImage: '/media/product/specialized/psychological-extra.webp',
    usersImage: '/media/product/specialized/psychological-users.webp',
    relatedCaseSlugs: ['zhejiang-outdoor', 'caseshow-57-66', 'caseshow-56-60'],
    description: '高空断桥、信任背摔等心理行为训练设施，强化团队协同与心理素质。',
    family: 'specialized',
  },
  // D. 训练器械与道具（1，含 3 个子 SKU）
  {
    id: 'accessories',
    index: 13,
    anchor: 'line-13',
    navKey: 'productLine13',
    shortTitle: '训练器械',
    title: '训练器械与道具',
    href: '/accessories',
    image: '/media/product/accessories/accessories-card.webp',
    heroImage: '/media/product/accessories/accessories-hero.webp',
    ogImage: '/media/product/accessories/accessories-og.webp',
    detailImages: [
      '/media/product/accessories/accessories-detail-1.webp',
      '/media/product/accessories/accessories-detail-2.webp',
      '/media/product/accessories/accessories-detail-3.webp',
    ],
    featureImages: {
      hazmat: '/media/product/accessories/accessories-feature-hazmat.webp',
      heat: '/media/product/accessories/accessories-feature-heat.webp',
      egress: '/media/product/accessories/accessories-feature-egress.webp',
      search: '/media/product/accessories/accessories-feature-search.webp',
      confined: '/media/product/accessories/accessories-feature-confined.webp',
      breach: '/media/product/accessories/accessories-feature-breach.webp',
    },
    configImage: '/media/product/accessories/accessories-config.webp',
    extraImage: '/media/product/accessories/accessories-extra.webp',
    usersImage: '/media/product/accessories/accessories-users.webp',
    relatedCaseSlugs: [],
    description: '热与烟、逃生、搜救、破拆及体能竞赛类设施，完善训练基地配套能力。',
    family: 'accessories',
    subLinks: [
      { title: '配件与道具', href: '/accessories', navKey: 'accessoriesOverview' },
      {
        title: '体能抗眩晕器械',
        href: '/accessories/fitness-equipment',
        navKey: 'accessoriesFitness',
      },
      {
        title: '竞赛类训练设施',
        href: '/accessories/competition',
        navKey: 'accessoriesCompetition',
      },
    ],
  },
];

/** 吸顶导航板块分隔线（0-based，在该 index 前插入分隔） */
export const PRODUCT_NAV_DIVIDER_BEFORE = [4, 7, 12] as const;

export function linesByFamily(familyId: ProductFamilyId): ProductLine[] {
  return PRODUCT_LINES.filter((line) => line.family === familyId);
}

export function familyForLine(line: ProductLine): ProductFamily | undefined {
  return PRODUCT_FAMILIES.find((family) => family.id === line.family);
}

/** 按四大板块分组，供产品中心页分区展示 */
export const PRODUCT_LINES_BY_FAMILY = PRODUCT_FAMILIES.map((family) => ({
  family,
  lines: linesByFamily(family.id),
}));
