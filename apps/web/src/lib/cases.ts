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
    image: 'images/202101/29e0925cf89.jpg',
    client: '某省消防救援总队',
    completionDate: '2023-06',
    summary:
      '为省级消防救援总队建设综合训练基地，包含固定训练塔、CFBT 燃烧室及绳索救援训练区，满足全省消防指战员年度轮训需求。',
    highlights: [
      '7 层固定训练塔，含电梯井与楼梯塔',
      '双燃烧室配置，支持 CFBT 实战训练',
      '全镀锌钢结构，设计抗风荷载 290+ km/h',
      '交钥匙工程，从设计到安装全程服务',
    ],
    specs: [
      { label: '塔型', value: '固定训练塔 · 高层系列' },
      { label: '层数', value: '7 层' },
      { label: '燃烧室', value: '2 间' },
      { label: '工期', value: '8 个月' },
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
    image: 'images/202102/5cc5571e0fc.jpg',
    client: '某理工大学',
    completionDate: '2022-09',
    summary: '为高校安全工程专业建设实训教育基地，涵盖消防、危化品处置、应急救援等教学实训场景。',
    highlights: [
      '教学友好型低强度燃烧室',
      '多专业共用开放式训练平台',
      '完整图纸供教学参考',
      '预算内快速落地标准塔型',
    ],
    specs: [
      { label: '塔型', value: '固定训练塔 · 三级报警系列' },
      { label: '层数', value: '4 层' },
      { label: '用途', value: '教学实训' },
      { label: '工期', value: '4 个月' },
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
    image: 'images/202604/db43cc3abac.jpg',
    client: '某市消防救援支队',
    completionDate: '2024-01',
    summary: '建设华南地区重点 CFBT（实火训练）中心，配备互锁隔热衬里燃烧室与完整热烟训练系统。',
    highlights: [
      '互锁隔热衬里，可承受 1100°C 高温',
      '无明火布置限制，支持多种燃烧模式',
      '低维护设计，衬里快速更换',
      '符合 NFPA 1402 训练设施标准',
    ],
    specs: [
      { label: '塔型', value: '固定训练塔 + 燃烧室' },
      { label: '燃烧室', value: '3 间（互锁衬里）' },
      { label: '温度', value: '最高 1100°C' },
      { label: '工期', value: '10 个月' },
    ],
  },
];

export function getCaseBySlug(slug: string): CaseStudy | undefined {
  return caseStudies.find((c) => c.slug === slug);
}

export function getAllCaseSlugs(): string[] {
  return caseStudies.map((c) => c.slug);
}
