export interface CaseStudy {
  slug: string;
  title: string;
  location: string;
  category: string;
  image: string;
  client: string;
  completionDate: string;
  summary: string;
  highlights: string[];
  specs: { label: string; value: string }[];
}

export const caseStudies: CaseStudy[] = [
  {
    slug: 'henan-fire-rescue',
    title: '某省消防救援总队训练基地',
    location: '河南',
    category: '消防救援',
    image: 'content/case-henan-hero.png',
    client: '某省消防救援总队',
    completionDate: '2023-06',
    summary:
      '为省级消防救援总队建设综合训练基地：7 层固定训练塔、双燃烧室与绳索救援区一体规划，支撑全省指战员年度轮训与多科目协同演练。',
    highlights: [
      '7 层固定训练塔，含电梯井与楼梯塔，支持登高、破拆与垂直救援科目',
      '双燃烧室配置，可并行安排 CFBT / 热烟训练批次',
      '全镀锌钢结构，设计抗风荷载 290+ km/h，适应平原高风区',
      '交钥匙工程：勘察—设计—制造—安装—验收培训一站对接',
    ],
    specs: [
      { label: '塔型', value: '固定训练塔 · 高层系列' },
      { label: '层数', value: '7 层' },
      { label: '燃烧室', value: '2 间' },
      { label: '结构', value: '全镀锌钢结构' },
      { label: '抗风设计', value: '290+ km/h' },
      { label: '工期', value: '8 个月' },
      { label: '交付模式', value: '交钥匙工程' },
      { label: '地点', value: '河南' },
    ],
  },
  {
    slug: 'shandong-police',
    title: '某市公安特警攀登训练楼',
    location: '山东',
    category: '公安武警',
    image: 'images/202011/fc2d5975875.jpg',
    client: '某市公安局特警支队',
    completionDate: '2022-11',
    summary:
      '为公安特警支队定制攀登与破拆综合训练设施，涵盖垂直攀登、窗口突入、绳索下降等多场景战术训练。',
    highlights: [
      '定制平面布局，融入特警战术场景',
      '多种训练道具集成（破拆口、绳索锚点）',
      '模块化燃烧室可独立使用',
      '符合公安训练设施标准规范',
    ],
    specs: [
      { label: '塔型', value: '固定训练塔 · 定制' },
      { label: '层数', value: '5 层' },
      { label: '训练场景', value: '攀登 / 破拆 / 绳索' },
      { label: '工期', value: '6 个月' },
    ],
  },
  {
    slug: 'shanxi-mine-rescue',
    title: '某矿山救援队训练设施',
    location: '山西',
    category: '矿山救援',
    image: 'images/202603/59243364bd4.jpg',
    client: '某矿业集团救援队',
    completionDate: '2023-03',
    summary: '为矿山救援队伍建设地下空间模拟与垂直救援训练设施，提升复杂环境下的救援实战能力。',
    highlights: [
      '模拟地下巷道与竖井救援场景',
      '耐高腐蚀环境镀锌钢结构',
      '集成烟雾发生器与热训练系统',
      '可扩展模块化设计',
    ],
    specs: [
      { label: '塔型', value: '模块化训练塔' },
      { label: '模块数', value: '4 模块' },
      { label: '特殊配置', value: '竖井模拟 / 烟雾系统' },
      { label: '工期', value: '5 个月' },
    ],
  },
  {
    slug: 'jiangsu-university',
    title: '某高校安全实训教育基地',
    location: '江苏',
    category: '院校教育',
    image: 'content/case-js-hero.png',
    client: '某理工大学',
    completionDate: '2022-09',
    summary:
      '为高校安全工程相关专业建设实训教育基地：紧凑标准固定塔 + 教学友好型低强度燃烧模块与开放式训练平台，兼顾教学演示、课程实训与预算可控落地。',
    highlights: [
      '教学友好型低强度燃烧模块，适配课堂演示与分段实训',
      '多专业共用开放式训练平台，绳索与基础科目可错峰排课',
      '提供完整图纸与教学参考资料，便于课程与设备对照讲解',
      '预算内快速落地标准塔型，缩短院校采购与建设周期',
    ],
    specs: [
      { label: '塔型', value: '固定训练塔 · 三级报警系列' },
      { label: '层数', value: '4 层' },
      { label: '用途', value: '教学实训' },
      { label: '燃烧模块', value: '教学友好型低强度' },
      { label: '平台', value: '多专业开放式训练平台' },
      { label: '工期', value: '4 个月' },
      { label: '地点', value: '江苏' },
    ],
  },
  {
    slug: 'zhejiang-outdoor',
    title: '某景区户外拓展训练基地',
    location: '浙江',
    category: '景区拓展',
    image: 'images/202011/9dc9a30843c.jpg',
    client: '某旅游景区管理公司',
    completionDate: '2021-12',
    summary: '为景区建设户外拓展训练与高空作业训练设施，兼顾游客体验与专业救援队伍训练需求。',
    highlights: [
      '景观融合式外观设计',
      '高空绳索与攀岩训练集成',
      '安全护栏与防坠系统完备',
      '低维护成本镀锌结构',
    ],
    specs: [
      { label: '塔型', value: '模块化训练塔 · M 系列' },
      { label: '高度', value: '18 米' },
      { label: '功能', value: '拓展 / 绳索 / 攀岩' },
      { label: '工期', value: '3 个月' },
    ],
  },
  {
    slug: 'guangdong-cfbt',
    title: '某消防救援支队 CFBT 训练中心',
    location: '广东',
    category: 'CFBT',
    image: 'content/case-gd-hero.png',
    client: '某市消防救援支队',
    completionDate: '2024-01',
    summary:
      '建设华南地区重点 CFBT（实火训练）中心：固定训练塔与互锁隔热衬里燃烧室组合，配套热烟训练系统，服务支队实战化训练与区域协作演练。',
    highlights: [
      '互锁隔热衬里，可承受约 1100°C 工况温度，面向高频 CFBT 使用',
      '燃烧模式可灵活布置，满足不同热烟与搜救课目编排',
      '衬里模块化，便于检查与局部更换，降低停训时间',
      '设施设计参考 NFPA 1402 训练设施相关实践要求',
    ],
    specs: [
      { label: '塔型', value: '固定训练塔 + 燃烧室' },
      { label: '燃烧室', value: '3 间（互锁衬里）' },
      { label: '衬里工况', value: '最高约 1100°C' },
      { label: '热烟系统', value: '完整热烟训练配置' },
      { label: '参照标准', value: 'NFPA 1402（实践参考）' },
      { label: '工期', value: '10 个月' },
      { label: '地点', value: '广东' },
    ],
  },
];

export function getCaseBySlug(slug: string): CaseStudy | undefined {
  return caseStudies.find((c) => c.slug === slug);
}

export function getAllCaseSlugs(): string[] {
  return caseStudies.map((c) => c.slug);
}
