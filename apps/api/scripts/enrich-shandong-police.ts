/**
 * 按 docs/case-center-content-ai-enrichment-plan.md（最新）丰富 shandong-police。
 * - 正文：##/### 标题 + 空行排版，禁止 **伪标题**
 * - 图片：1 封面 + 3~4 图集，全部压缩 WebP 入库；画廊 C 端本期不展示
 * - 不改 cases.ts 列表封面（列表走 API）
 *
 * 用法：pnpm --filter @tzj/api exec node --env-file=../../.env ./node_modules/tsx/dist/cli.mjs scripts/enrich-shandong-police.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ANCHOR = {
  slug: 'shandong-police',
  title: '某市公安特警攀登训练楼',
  client: '某市公安局特警支队',
  location: '山东',
  caseType: 'police' as const,
  facility: '定制攀登与破拆综合训练设施；5 层固定训练塔；攀登/破拆/绳索；模块化燃烧室可独立使用',
};

const PAYLOAD = {
  summary:
    '为公安特警支队定制攀登与破拆综合训练设施：5 层固定训练塔集成垂直攀登、窗口突入与绳索下降科目，配套可独立使用的模块化燃烧室，支撑多场景战术训练。',
  seoTitle: '山东公安特警攀登训练楼案例｜破拆与绳索综合训练',
  seoDesc:
    '山东某市公安局特警支队攀登训练楼案例：5 层定制固定塔、破拆口与绳索锚点、模块化燃烧室，了解拓之迹公安战术训练设施交付。',
  coverImage: 'content/case-shandong-police-hero.webp',
  images: [
    'content/case-shandong-police-gallery-1.webp',
    'content/case-shandong-police-gallery-2.webp',
    'content/case-shandong-police-gallery-3.webp',
    'content/case-shandong-police-gallery-4.webp',
  ],
  highlights: [
    '定制平面布局，融入特警战术场景，覆盖攀登、突入与下降动线',
    '多种训练道具集成（破拆口、绳索锚点），支持窗口突入与绳索科目',
    '模块化燃烧室可独立使用，便于分班热烟或搜救课目编排',
    '符合公安训练设施标准规范，便于验收与日常教学组织',
  ],
  specs: [
    { label: '塔型', value: '固定训练塔 · 定制' },
    { label: '层数', value: '5 层' },
    { label: '训练场景', value: '攀登 / 破拆 / 绳索' },
    { label: '燃烧室', value: '模块化，可独立使用' },
    { label: '工期', value: '6 个月' },
    { label: '地点', value: '山东' },
  ],
  // 3.2 + 3.2.1：##/### + 标题前后空行；禁止 **伪标题**
  // 画廊 UI 本期不做：正文内嵌图集（与 henan 标杆一致），图文前后各留空行
  description: `## 项目背景

市公安局特警支队需要在同一场地完成垂直攀登、窗口突入与绳索下降等战术科目训练。原有设施科目割裂、道具分散，难以按实战动线连贯排课，也难以支撑分班并行与考核抽检。

客户希望建设一座定制化攀登训练楼，把破拆口、绳索锚点与可独立使用的模块化燃烧室纳入统一平面，服务日常战术训练、教学示范与阶段性考核。

## 建设方案

方案以 **5 层定制固定训练塔** 为主结构，按特警战术场景定制平面：外立面与楼层设置破拆窗/突入口，平台与梁柱预留绳索锚点，垂直面支持攀登科目。

![侧面外景](content/case-shandong-police-gallery-1.webp)

地面侧配置可独立使用的模块化燃烧室，与主塔科目错峰或分班并行。整体动线按「攀登接近 → 窗口突入 → 绳索撤离」组织，并预留教员观察与分组集结空间，减少科目切换与无效等待。

![仰视主塔](content/case-shandong-police-gallery-4.webp)

## 核心亮点

### 战术化平面定制

布局围绕特警常用接近与突入路径设计，楼层平台与窗口位置服务于分组对抗与教员观察，而不是通用消防塔简单复用，保证训练场景与战术意图一致。

### 破拆与绳索道具集成

破拆口、绳索锚点与下降路径按训练大纲布置，支持窗口突入、绳索下降及组合课目，减少临时加装道具带来的安全与验收风险，便于形成可重复的标准课表。

![破拆口与钢构近景](content/case-shandong-police-gallery-2.webp)

### 模块化燃烧室可独立使用

燃烧室与主塔解耦排课，可单独安排热烟/搜救相关课目，也可与塔内科目轮换，提高场地利用率，避免整场停训。

![燃烧室内部](content/case-shandong-police-gallery-3.webp)

### 规范与验收友好

设施按公安训练设施相关规范组织设计与验收资料，点位、防护与操作说明齐套，便于支队将训练楼纳入日常教学与考核体系。

## 交付与服务

项目约 **6 个月** 完成：战术科目与平面确认 → 结构与道具点位会审 → 制造安装 → 燃烧室联调 → 教员操作与安全培训。

验收重点包括破拆口/锚点可用性、防护与动线清晰度，以及燃烧室独立运行条件；培训同步移交日常巡检与维保要点。

## 项目价值

训练楼投入使用后，特警支队可在单一场地完成攀登、破拆与绳索等多场景战术训练，降低多场地切换成本，提升课表密度与考核可组织性。

同类公安项目可优先锁定：定制平面与科目动线、破拆/绳索点位、燃烧室独立排课边界，再按编制规模调节层数与道具密度。
`,
};

function assertMarkdownSpacing(md: string): void {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!/^#{2,3}\s+\S/.test(line)) continue;
    if (i > 0 && (lines[i - 1] ?? '').trim() !== '') {
      throw new Error(`标题前缺少空行: L${i + 1} ${line}`);
    }
    if (i < lines.length - 1 && (lines[i + 1] ?? '').trim() !== '') {
      throw new Error(`标题后缺少空行: L${i + 1} ${line}`);
    }
  }
  if (/\n\*\*[^*\n]{2,40}\*\*\s*\n/.test(`\n${md}\n`)) {
    // 允许正文加粗短词；拦截「整行伪标题」形态：**标题**\n\n
    const fake = [...md.matchAll(/^\*\*[^*\n]+\*\*\s*$/gm)].map((m) => m[0]);
    if (fake.length) throw new Error(`发现 **伪标题**: ${fake.join(' | ')}`);
  }
}

async function main() {
  const existing = await prisma.case.findUnique({ where: { slug: ANCHOR.slug } });
  if (!existing) {
    console.error(`missing slug: ${ANCHOR.slug}`);
    process.exit(1);
  }

  const mismatches: string[] = [];
  if (existing.title !== ANCHOR.title) mismatches.push(`title: ${existing.title}`);
  if (existing.client !== ANCHOR.client) mismatches.push(`client: ${existing.client}`);
  if (existing.location !== ANCHOR.location) mismatches.push(`location: ${existing.location}`);
  if (existing.caseType !== ANCHOR.caseType) mismatches.push(`caseType: ${existing.caseType}`);
  if (mismatches.length) {
    console.error('锚点偏离，中止写入:', mismatches);
    process.exit(1);
  }

  const description = PAYLOAD.description.trim();
  assertMarkdownSpacing(description);

  const descLen = description.replace(/\s/g, '').length;
  console.log('anchor facility:', ANCHOR.facility);
  console.log('description chars (no whitespace):', descLen);
  console.log('images:', PAYLOAD.images.length);

  if (descLen < 800 || descLen > 1200) {
    console.warn(`description length ${descLen} outside 800~1200 window`);
  }
  if (PAYLOAD.images.length < 3) {
    throw new Error('images[] 至少 3 张（本期画廊不展示，但仍需入库）');
  }

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
      description,
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
