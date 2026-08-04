/**
 * 一次性：丰富固定塔 Hub 精选 3 个案例（封面/正文图/Markdown/specs）。
 * 内容写在 DB（Admin Markdown 同源），本脚本仅作本地内容回填。
 *
 * 用法：pnpm --filter @tzj/api exec node --env-file=../../.env ./node_modules/tsx/dist/cli.mjs scripts/enrich-featured-cases.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Spec = { label: string; value: string };

type CasePayload = {
  slug: string;
  summary: string;
  seoDesc: string;
  coverImage: string;
  images: string[];
  highlights: string[];
  specs: Spec[];
  description: string;
};

const CASES: CasePayload[] = [
  {
    slug: 'henan-fire-rescue',
    summary:
      '为省级消防救援总队建设综合训练基地：7 层固定训练塔、双燃烧室与绳索救援区一体规划，支撑全省指战员年度轮训与多科目协同演练。',
    seoDesc:
      '河南省级消防救援训练基地案例：7 层固定训练塔、双燃烧室与交钥匙交付，了解拓之迹综合训练场落地路径。',
    coverImage: 'content/case-henan-hero.png',
    // 多机位均以封面建筑为母版生成（开敞楼梯塔 + 封闭窗井 + 双侧底层舱）
    images: [
      'content/case-henan-hero.png',
      'content/case-henan-angle-wide.png',
      'content/case-henan-angle-stair.png',
      'content/case-henan-angle-panel.png',
      'content/case-henan-angle-low.png',
    ],
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
    description: `## 项目背景

省级消防救援总队承担全省指战员轮训与考核任务，原有场地分散、科目割裂，难以在同一基地完成登高、破拆、热烟与绳索救援的连贯训练。客户需要一座可长期服役、便于排课的综合训练场，而不是单点设施堆叠。

## 客户挑战

- **容量与节拍**：需同时服务多支队伍轮训，燃烧室与主塔科目要能错峰并行。
- **结构耐久**：平原风区与高频使用，要求镀锌钢结构与可维护燃烧室配置。
- **交钥匙边界**：希望单一责任方覆盖勘察、设计、制造、安装与验收培训，缩短多头沟通。

## 方案与配置

以 **7 层固定训练塔** 作为场地主轴，配套双燃烧室与绳索救援区，形成「主塔—热烟—绳索」三区联动。布局按轮训课表预留排队与装备动线，减少科目切换时的无效等待。

![训练基地全景（远景）](content/case-henan-angle-wide.png)

主塔采用「开敞楼梯塔 + 封闭窗井」双段式布局：一侧服务垂直动线与体能科目，一侧提供破拆窗与搜救通道。

![楼梯塔侧视角](content/case-henan-angle-stair.png)

主塔侧重点：

- 电梯井 / 楼梯塔组合，覆盖垂直救援与登高体能科目
- 破拆窗、通道与锚点按实战动线布置
- 全镀锌钢结构，降低全生命周期维护成本

![封闭窗井侧视角](content/case-henan-angle-panel.png)

底层双侧附属舱作为燃烧 / 热烟训练空间，与主塔同场衔接，支持分班并行或科目轮换。

![仰视主塔与底层训练舱](content/case-henan-angle-low.png)

燃烧室侧重点：

- 双室配置，可并行安排 CFBT / 热烟训练批次
- 与主塔动线衔接，便于「热烟 → 搜救 / 破拆」连贯演练

## 交付过程

项目按交钥匙节奏推进：场地勘察与科目清单确认 → 结构与工艺设计会审 → 工厂制造与现场安装 → 联合验收与操作培训。总工期约 **8 个月**，验收阶段同步完成教员操作与维保要点移交。

## 成果与可复制经验

建成后，基地可作为省级轮训枢纽，在同一场地完成多层塔、热烟与绳索科目编排。对同类综合训练场，可优先复用「主塔定轴 + 双室并行 + 交钥匙边界清晰」的组合，按人员规模再调节层数与燃烧室数量。
`,
  },
  {
    slug: 'guangdong-cfbt',
    summary:
      '建设华南地区重点 CFBT（实火训练）中心：固定训练塔与互锁隔热衬里燃烧室组合，配套热烟训练系统，服务支队实战化训练与区域协作演练。',
    seoDesc:
      '广东消防救援支队 CFBT 训练中心案例：互锁隔热衬里燃烧室、热烟系统与固定塔组合，了解拓之迹实火训练设施交付。',
    coverImage: 'content/case-gd-hero.png',
    // 多机位均以封面为母版：黑塔+红护栏 + 黑色波纹燃烧室楼体
    images: [
      'content/case-gd-hero.png',
      'content/case-gd-angle-wide.png',
      'content/case-gd-angle-tower.png',
      'content/case-gd-angle-burn.png',
      'content/case-gd-angle-low.png',
    ],
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
    description: `## 项目背景

支队实战化训练对 **CFBT / 热烟** 科目依赖度高，既要温度与烟气可控，又要能与塔内搜救、破拆动线衔接。客户希望建成区域可用的实火训练中心，支撑本支队日常课目与协作演练。

## 客户挑战

- **高温耐久与可维护性**：高频使用下，衬里必须可检查、可局部更换。
- **科目编排弹性**：同一套燃烧室需覆盖多种热烟与搜救组合，避免「一室一课」僵化。
- **安全边界清晰**：训练强度高，设施本身的隔热、互锁与观察条件必须可靠。

## 方案与配置

方案以固定训练塔为外沿结构骨架，核心能力落在 **3 间互锁隔热衬里燃烧室** 与热烟系统。塔室组合保证学员从热环境过渡到搜救/破拆科目时动线连续。

![CFBT 中心全景（远景）](content/case-gd-angle-wide.png)

设施呈现「黑色网孔训练塔 + 黑色波纹燃烧室楼体」一体布局，红色护栏与管线统一安全识别色。

![训练塔侧视角](content/case-gd-angle-tower.png)

舱室侧重点：

- 空舱交接时可直观检查衬里接缝与舱门状态
- 观察与进出路径按教员控制习惯布置
- 支持分班轮换，降低整场停训概率

![燃烧室楼体与重型舱门](content/case-gd-angle-burn.png)

衬里与外立面侧重点：

- 互锁隔热衬里便于巡检与局部更换
- 面向约 1100°C 工况温度的隔热体系
- 重型舱门与黑灰色外立面统一工业语言

![仰视训练塔与燃烧室组合](content/case-gd-angle-low.png)

## 交付过程

项目周期约 **10 个月**。关键节点包括：科目与热负荷确认 → 塔室一体设计与安全联锁会审 → 衬里与燃烧室制造安装 → 热烟系统联调 → 教员实操与维保培训。验收以「可排课、可巡检、可更换」为通过标准，而不只看外观完工。

## 成果与可复制经验

中心投入使用后，支队可在可控热烟环境中稳定开展 CFBT 相关课目，并与塔内搜救训练衔接。同类华南湿热地区项目，建议优先锁定：**互锁衬里规格、更换路径、热烟联调责任界面**，再扩展燃烧室数量。
`,
  },
  {
    slug: 'jiangsu-university',
    summary:
      '为高校安全工程相关专业建设实训教育基地：紧凑标准固定塔 + 教学友好型低强度燃烧模块与开放式训练平台，兼顾教学演示、课程实训与预算可控落地。',
    seoDesc:
      '江苏高校安全实训教育基地案例：四级标准固定塔、教学型燃烧模块与开放训练平台，了解拓之迹院校实训设施方案。',
    coverImage: 'content/case-js-hero.png',
    // 多机位均以封面为母版：开放镀锌钢塔 + 橡胶垫体能区 + 校园背景
    images: [
      'content/case-js-hero.png',
      'content/case-js-angle-wide.png',
      'content/case-js-angle-stair.png',
      'content/case-js-angle-yard.png',
      'content/case-js-angle-low.png',
    ],
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
    description: `## 项目背景

高校安全工程 / 应急管理相关专业需要可上课、可演示、可考核的实训载体。客户希望在校园内落地一座 **教学优先** 的紧凑训练设施，覆盖消防基础、应急处置认知与部分绳索科目，同时控制投资与运维复杂度。

## 客户挑战

- **教学强度 ≠ 实战支队强度**：设备要安全、可讲解，避免过度实火负荷。
- **多专业共用**：同一平台需服务不同课程班次，动线与排课要简单。
- **预算与周期**：院校项目对标准塔型、图纸完整性与交付节奏更敏感。

## 方案与配置

选用 **4 层标准固定塔（三级报警系列）** 作为主结构，配套教学友好型低强度燃烧模块与开放式训练平台。整体尺度紧凑，便于嵌入校园规划红线。

![校园实训场全景（远景）](content/case-js-angle-wide.png)

主塔为开放式镀锌钢结构，内部折返楼梯贯通各层，便于教学观摩与分组指导。

![开放钢塔楼梯侧视角](content/case-js-angle-stair.png)

平台侧重点：

- 开放式布局，便于教师观察与分组指导
- 绳索锚点与基础科目分区清晰，支持错峰排课
- 与主塔动线短接，减少课程切换成本

![体能实训区与钢塔组合](content/case-js-angle-yard.png)

塔型与场地侧重点：

- 开放式镀锌钢结构，层数紧凑，适配院校尺度
- 标准塔型便于预算内快速落地
- 校园环境中落地，便于教学观摩与排课

![仰视标准训练塔](content/case-js-angle-low.png)

## 交付过程

项目约 **4 个月** 完成：需求与课程清单对齐 → 标准塔型确认与校园总图复核 → 制造安装 → 教学演示与安全操作培训。验收重点包括教学动线、护栏/防坠与设备讲解资料是否齐套。

## 成果与可复制经验

基地成为安全类课程的校内实训锚点，可支撑认知课、基础实操与综合演练周。同类院校项目可优先采用「标准塔型 + 教学模块 + 开放平台」组合，把预算留给可讲解、可维护、可排课的核心能力，而不是盲目堆叠实战级燃烧室数量。
`,
  },
];

async function main() {
  for (const item of CASES) {
    const existing = await prisma.case.findUnique({ where: { slug: item.slug } });
    if (!existing) {
      console.warn(`skip missing slug: ${item.slug}`);
      continue;
    }

    await prisma.case.update({
      where: { slug: item.slug },
      data: {
        summary: item.summary,
        seoDesc: item.seoDesc,
        coverImage: item.coverImage,
        images: item.images,
        highlights: item.highlights,
        specs: item.specs,
        description: item.description.trim(),
      },
    });
    console.log(`updated ${item.slug}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
