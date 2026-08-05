/**
 * 按最新 docs/case-center-content-ai-enrichment-plan.md 复核升级 jiangsu-university。
 *
 * 用法：pnpm --filter @tzj/api exec node --env-file=../../.env ./node_modules/tsx/dist/cli.mjs scripts/enrich-jiangsu-university.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ANCHOR = {
  slug: 'jiangsu-university',
  title: '某高校安全实训教育基地',
  client: '某理工大学',
  location: '江苏',
  caseType: 'school' as const,
  facility: '4 层标准固定塔（三级报警系列）+ 教学友好型低强度燃烧模块 + 开放式训练平台',
};

const GALLERY = [
  'content/case-jiangsu-university-gallery-1.webp',
  'content/case-jiangsu-university-gallery-2.webp',
  'content/case-jiangsu-university-gallery-3.webp',
  'content/case-jiangsu-university-gallery-4.webp',
] as const;

const PAYLOAD = {
  summary:
    '为高校安全工程相关专业建设实训教育基地：紧凑标准固定塔 + 教学友好型低强度燃烧模块与开放式训练平台，兼顾教学演示、课程实训与预算可控落地。',
  seoTitle: '江苏高校安全实训教育基地案例｜标准塔与教学模块',
  seoDesc:
    '江苏高校安全实训教育基地案例：4 层标准固定塔、教学型低强度燃烧模块与开放训练平台，了解拓之迹院校实训设施方案。',
  coverImage: 'content/case-jiangsu-university-hero.webp',
  detailCoverImage: 'content/case-jiangsu-university-detail-hero.webp',
  images: [...GALLERY],
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

高校安全工程 / 应急管理相关专业需要可上课、可演示、可考核的实训载体。客户希望在校园内落地一座教学优先的紧凑训练设施，覆盖消防基础、应急处置认知与部分绳索科目。

同时需控制投资与运维复杂度，避免按实战支队强度堆叠设备，影响课程排课与安全讲解。

## 建设方案

选用 **4 层标准固定塔（三级报警系列）** 作为主结构，配套教学友好型低强度燃烧模块与开放式训练平台。整体尺度紧凑，便于嵌入校园规划红线。

![某高校安全实训教育基地 · 校园全景（1/4）](content/case-jiangsu-university-gallery-1.webp)

主塔为开放式镀锌钢结构，内部折返楼梯贯通各层，便于教学观摩与分组指导；平台与主塔动线短接，支持多专业错峰排课。

![某高校安全实训教育基地 · 开放钢塔楼梯侧（2/4）](content/case-jiangsu-university-gallery-2.webp)

## 核心亮点

### 教学友好型低强度燃烧模块

燃烧模块强度按课堂演示与分段实训设计，安全、可讲解，避免过度实火负荷，适配院校课程节奏。

![某高校安全实训教育基地 · 体能实训区与钢塔（3/4）](content/case-jiangsu-university-gallery-3.webp)

### 多专业开放式训练平台

开放式布局便于教师观察与分组指导，绳索与基础科目分区清晰，支持不同课程班次错峰使用。

![某高校安全实训教育基地 · 教学燃烧模块（4/4）](content/case-jiangsu-university-gallery-4.webp)

### 图纸与教学资料齐套

提供完整图纸与教学参考资料，便于课程与设备对照讲解，降低教员备课与设备认知成本。

### 标准塔型预算内快落地

标准塔型便于院校预算内快速落地，缩短采购与建设周期，把投资留给可讲解、可维护、可排课的核心能力。

## 交付与服务

项目约 **4 个月** 完成：需求与课程清单对齐 → 标准塔型确认与校园总图复核 → 制造安装 → 教学演示与安全操作培训。

验收重点包括教学动线、护栏/防坠与设备讲解资料是否齐套。

## 项目价值

基地成为安全类课程的校内实训锚点，可支撑认知课、基础实操与综合演练周。同类院校项目可优先采用「标准塔型 + 教学模块 + 开放平台」组合，按专业规模调节层数与模块配置，而不是盲目堆叠实战级燃烧室数量。
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
