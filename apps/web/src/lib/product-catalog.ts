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
  image: string;
  description: string;
  family: ProductFamilyId;
  subLinks?: { title: string; href: string; navKey?: string }[];
};

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
    image: 'images/202101/29e0925cf89.jpg',
    description: '工业级全镀锌钢结构，标准与定制，最坚固耐用的多层实战火场训练主体。',
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
    image: '/media/modular-hero.jpg',
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
    image: 'images/202011/fc2d5975875.jpg',
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
    image: 'images/202102/5cc5571e0fc.jpg',
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
    href: '/burn-rooms',
    image: '/media/burn-room.webp',
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
    image: 'images/202604/db43cc3abac.jpg',
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
    image: 'images/202605/041a07c4595.jpg',
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
    image: 'images/202605/041a07c4595.jpg',
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
    image: '/media/tactical.jpg',
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
    image: '/media/hazmat-trailer.webp',
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
    image: 'images/202603/59243364bd4.jpg',
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
    image: 'images/202011/9dc9a30843c.jpg',
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
    image: 'images/202105/9c5be9ab1a5.jpg',
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
