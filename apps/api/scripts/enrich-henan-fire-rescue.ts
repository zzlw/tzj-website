/**
 * 按最新 docs/case-center-content-ai-enrichment-plan.md 复核升级 henan-fire-rescue。
 * - 保留既有同建筑 AI 图（✅），压缩为 WebP
 * - 新增独立 detailCoverImage（约 3:1）
 * - 正文标准章节 + ### + 3.8 内嵌图集/alt
 *
 * 用法：pnpm --filter @tzj/api exec node --env-file=../../.env ./node_modules/tsx/dist/cli.mjs scripts/enrich-henan-fire-rescue.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ANCHOR = {
  slug: 'henan-fire-rescue',
  title: '某省消防救援总队训练基地',
  client: '某省消防救援总队',
  location: '河南',
  caseType: 'fire' as const,
  facility: '7 层固定训练塔 + 双燃烧室 + 绳索救援区；交钥匙；抗风 290+ km/h',
};

const GALLERY = [
  'content/case-henan-fire-rescue-gallery-1.webp',
  'content/case-henan-fire-rescue-gallery-2.webp',
  'content/case-henan-fire-rescue-gallery-3.webp',
  'content/case-henan-fire-rescue-gallery-4.webp',
] as const;

const PAYLOAD = {
  summary:
    '为省级消防救援总队建设综合训练基地：7 层固定训练塔、双燃烧室与绳索救援区一体规划，支撑全省指战员年度轮训与多科目协同演练。',
  seoTitle: '河南省级消防救援训练基地案例｜7 层塔与双燃烧室',
  seoDesc:
    '河南省级消防救援训练基地案例：7 层固定训练塔、双燃烧室与交钥匙交付，了解拓之迹综合训练场落地路径。',
  coverImage: 'content/case-henan-fire-rescue-hero.webp',
  detailCoverImage: 'content/case-henan-fire-rescue-detail-hero.webp',
  images: [...GALLERY],
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

省级消防救援总队承担全省指战员轮训与考核任务，原有场地分散、科目割裂，难以在同一基地完成登高、破拆、热烟与绳索救援的连贯训练。

客户需要一座可长期服役、便于排课的综合训练场，而不是单点设施堆叠，并希望单一责任方覆盖勘察到验收培训的交钥匙边界。

## 建设方案

方案以 **7 层固定训练塔** 作为场地主轴，配套双燃烧室与绳索救援区，形成「主塔—热烟—绳索」三区联动。布局按轮训课表预留排队与装备动线，减少科目切换时的无效等待。

![某省消防救援总队训练基地 · 外景全景（1/4）](content/case-henan-fire-rescue-gallery-1.webp)

主塔采用「开敞楼梯塔 + 封闭窗井」双段式布局：一侧服务垂直动线与体能科目，一侧提供破拆窗与搜救通道；底层双侧附属舱作为燃烧 / 热烟训练空间，与主塔同场衔接。

![某省消防救援总队训练基地 · 楼梯塔侧视角（2/4）](content/case-henan-fire-rescue-gallery-2.webp)

## 核心亮点

### 7 层主塔覆盖多科目

电梯井与楼梯塔组合，支持登高、破拆与垂直救援科目编排；破拆窗、通道与锚点按实战动线布置，便于分组轮训。

![某省消防救援总队训练基地 · 封闭窗井与钢构（3/4）](content/case-henan-fire-rescue-gallery-3.webp)

### 双燃烧室并行排课

双室配置可并行安排 CFBT / 热烟训练批次，并与主塔搜救、破拆动线衔接，提高场地利用率。

![某省消防救援总队训练基地 · 燃烧室内部（4/4）](content/case-henan-fire-rescue-gallery-4.webp)

### 平原风区耐久结构

全镀锌钢结构，设计抗风荷载 290+ km/h，适配平原高风区与高频使用，降低全生命周期维护成本。

### 交钥匙一站对接

勘察—设计—制造—安装—验收培训由单一责任方推进，缩短多头沟通，验收同步完成教员操作与维保要点移交。

## 交付与服务

项目按交钥匙节奏推进，总工期约 **8 个月**：场地勘察与科目清单确认 → 结构与工艺设计会审 → 工厂制造与现场安装 → 联合验收与操作培训。

验收以「可排课、可并行、可维护」为通过标准，而不只看外观完工。

## 项目价值

建成后，基地可作为省级轮训枢纽，在同一场地完成多层塔、热烟与绳索科目编排。同类综合训练场可优先复用「主塔定轴 + 双室并行 + 交钥匙边界清晰」的组合，按人员规模再调节层数与燃烧室数量。
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
  const fake = [...md.matchAll(/^\*\*[^*\n]+\*\*\s*$/gm)].map((m) => m[0]);
  if (fake.length) throw new Error(`发现 **伪标题**: ${fake.join(' | ')}`);
}

function assertEmbeddedGallery(md: string, images: string[]): void {
  const embeds = [...md.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1] ?? '');
  if (embeds.length < 3) throw new Error(`正文内嵌图集不足 3 张，当前 ${embeds.length}`);
  for (const url of embeds) {
    if (!images.includes(url)) throw new Error(`内嵌图不在 images[]: ${url}`);
  }
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/^!\[[^\]]*\]\([^)]+\)$/.test(lines[i] ?? '')) continue;
    if (i > 0 && (lines[i - 1] ?? '').trim() !== '') {
      throw new Error(`图片前缺少空行: L${i + 1}`);
    }
    if (i < lines.length - 1 && (lines[i + 1] ?? '').trim() !== '') {
      throw new Error(`图片后缺少空行: L${i + 1}`);
    }
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
  assertEmbeddedGallery(description, PAYLOAD.images);

  const descLen = description.replace(/\s/g, '').length;
  console.log('anchor facility:', ANCHOR.facility);
  console.log('description chars (no whitespace):', descLen);
  console.log(
    'cover/detail/images:',
    PAYLOAD.coverImage,
    PAYLOAD.detailCoverImage,
    PAYLOAD.images.length,
  );

  if (descLen < 800 || descLen > 1200) {
    console.warn(`description length ${descLen} outside 800~1200 window`);
  }

  await prisma.case.update({
    where: { slug: ANCHOR.slug },
    data: {
      summary: PAYLOAD.summary,
      seoTitle: PAYLOAD.seoTitle,
      seoDesc: PAYLOAD.seoDesc,
      coverImage: PAYLOAD.coverImage,
      detailCoverImage: PAYLOAD.detailCoverImage,
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
