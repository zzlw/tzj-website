/**
 * 实验样板：按 docs/case-center-content-ai-enrichment-plan.md 丰富 shanxi-mine-rescue。
 * 仅写本地库；旧图 tower-eastside 与描述不符，按 ❌ 作废并换新 AI 图。
 *
 * 用法：pnpm --filter @tzj/api exec node --env-file=../../.env ./node_modules/tsx/dist/cli.mjs scripts/enrich-shanxi-mine-rescue.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** 锚点（现有记录，不得偏离） */
const ANCHOR = {
  slug: 'shanxi-mine-rescue',
  title: '某矿山救援队训练设施',
  client: '某矿业集团救援队',
  location: '山西',
  completionDate: new Date('2023-03-01'),
  caseType: 'enterprise' as const,
  facility:
    '地下空间模拟与垂直救援训练设施；模块化训练塔 · 4 模块；竖井模拟 / 烟雾系统',
};

const PAYLOAD = {
  summary:
    '为矿山救援队伍建设地下空间模拟与垂直救援训练设施：4 模块模块化训练塔集成竖井模拟与烟雾/热训练系统，提升复杂环境下的救援实战能力。',
  seoTitle: '山西矿山救援训练设施案例｜模块化竖井与巷道模拟',
  seoDesc:
    '山西某矿业集团救援队训练设施案例：4 模块模块化训练塔、竖井模拟与烟雾热训系统，了解拓之迹矿山救援训练场落地路径。',
  coverImage: 'content/case-shanxi-hero.png',
  images: [
    'content/case-shanxi-hero.png',
    'content/case-shanxi-angle-wide.png',
    'content/case-shanxi-angle-shaft.png',
    'content/case-shanxi-angle-tunnel.png',
    'content/case-shanxi-angle-low.png',
  ],
  highlights: [
    '模拟地下巷道与竖井救援场景，服务受限空间进出与垂直转运科目',
    '耐高腐蚀环境镀锌钢结构，适配工矿场地长期室外服役',
    '集成烟雾发生器与热训练系统，支撑烟气环境感知与协同搜救演练',
    '可扩展模块化设计，后续可按课目增补巷道或竖井模块',
  ],
  specs: [
    { label: '塔型', value: '模块化训练塔' },
    { label: '模块数', value: '4 模块' },
    { label: '特殊配置', value: '竖井模拟 / 烟雾系统' },
    { label: '训练场景', value: '地下巷道 / 垂直救援' },
    { label: '结构', value: '耐高腐蚀镀锌钢结构' },
    { label: '工期', value: '5 个月' },
    { label: '地点', value: '山西' },
  ],
  description: `## 项目背景

矿业集团救援队需在受限空间、竖井与烟气环境中保持稳定的实战训练节奏。原有场地难以同时覆盖地下巷道进出、垂直转运与烟气感知科目，客户希望落地一座可长期服役、可按课目扩展的模块化训练设施，而不是临时搭设的单点道具。

## 建设方案

方案以 **4 模块模块化训练塔** 为主骨架，组合竖井模拟舱段与地面巷道/硐室模拟模块，并集成烟雾发生器与热训练系统。布局按「地面巷道进出 → 竖井垂直转运 → 烟气环境搜救」编排动线，便于分班轮训与科目衔接。

![训练设施全景](content/case-shanxi-angle-wide.png)

主结构采用开放式镀锌钢框架，平台与护栏按训练安全识别色布置；竖井侧保留开敞笼体与格栅平台，便于教员观察与绳索科目展开。

![竖井结构近景](content/case-shanxi-angle-shaft.png)

## 核心亮点

**地下巷道与竖井一体**：地面封闭训练通道模拟硐室/巷道进出，竖井模块承载垂直救援与器材转运，形成连续受限空间课目链。

![巷道模拟内部](content/case-shanxi-angle-tunnel.png)

**工矿耐久结构**：镀锌钢结构面向高腐蚀室外环境选型，降低全生命周期维护负担，适配矿山训练场地长期使用。

**烟气与热训协同**：烟雾系统与热训练配置用于烟气环境感知、搜救协同与通讯组织演练，强度按救援队训练大纲可控调节。

**模块可扩展**：4 模块为交付基线，后续可按课目负荷增补巷道段或竖井层，避免一次性过度投资。

![仰视模块化训练塔](content/case-shanxi-angle-low.png)

## 交付与服务

项目约 **5 个月** 完成：训练科目与动线确认 → 模块组合与结构会审 → 工厂制造与现场安装 → 烟雾/热训系统联调 → 教员操作与维保培训。验收以「可排课、可扩展、可巡检」为通过标准。

## 项目价值

设施投入使用后，救援队可在同一场地完成巷道进出、竖井转运与烟气环境演练，缩短多场地切换成本。同类工矿救援项目可优先锁定：**竖井与巷道动线、腐蚀环境结构选型、烟雾系统责任界面**，再按人员规模调节模块数量。
`,
};

async function main() {
  const existing = await prisma.case.findUnique({ where: { slug: ANCHOR.slug } });
  if (!existing) {
    console.error(`missing slug: ${ANCHOR.slug}`);
    process.exit(1);
  }

  // 锚点一致性校验（只读比对，发现偏离则中止）
  const mismatches: string[] = [];
  if (existing.title !== ANCHOR.title) mismatches.push(`title: ${existing.title}`);
  if (existing.client !== ANCHOR.client) mismatches.push(`client: ${existing.client}`);
  if (existing.location !== ANCHOR.location) mismatches.push(`location: ${existing.location}`);
  if (existing.caseType !== ANCHOR.caseType) mismatches.push(`caseType: ${existing.caseType}`);
  if (mismatches.length) {
    console.error('锚点偏离，中止写入:', mismatches);
    process.exit(1);
  }

  const descLen = PAYLOAD.description.replace(/\s/g, '').length;
  console.log('anchor facility:', ANCHOR.facility);
  console.log('description chars (no whitespace):', descLen);
  console.log('old cover (void):', existing.coverImage);

  await prisma.case.update({
    where: { slug: ANCHOR.slug },
    data: {
      summary: PAYLOAD.summary,
      seoTitle: PAYLOAD.seoTitle,
      seoDesc: PAYLOAD.seoDesc,
      coverImage: PAYLOAD.coverImage,
      images: PAYLOAD.images,
      highlights: PAYLOAD.highlights,
      specs: PAYLOAD.specs,
      description: PAYLOAD.description.trim(),
      // 旧图作废：不再引用 tower-eastside
    },
  });

  console.log(`updated ${ANCHOR.slug}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
