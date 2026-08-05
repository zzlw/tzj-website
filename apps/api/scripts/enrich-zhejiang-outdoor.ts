/**
 * 按 docs/case-center-content-ai-enrichment-plan.md（含 3.8 正文内嵌图集）丰富 zhejiang-outdoor。
 *
 * 用法：pnpm --filter @tzj/api exec node --env-file=../../.env ./node_modules/tsx/dist/cli.mjs scripts/enrich-zhejiang-outdoor.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ANCHOR = {
  slug: 'zhejiang-outdoor',
  title: '某景区户外拓展训练基地',
  client: '某旅游景区管理公司',
  location: '浙江',
  caseType: 'scenic' as const,
  facility: '模块化训练塔 · M 系列；约 18 米；拓展 / 绳索 / 攀岩；景观融合；镀锌低维护',
};

const GALLERY = [
  'content/case-zhejiang-outdoor-gallery-1.webp',
  'content/case-zhejiang-outdoor-gallery-2.webp',
  'content/case-zhejiang-outdoor-gallery-3.webp',
  'content/case-zhejiang-outdoor-gallery-4.webp',
] as const;

const PAYLOAD = {
  summary:
    '为景区建设户外拓展训练与高空作业训练设施：约 18 米模块化训练塔（M 系列）集成高空绳索与攀岩科目，景观融合式外观兼顾游客体验与专业救援队伍训练需求。',
  seoTitle: '浙江景区户外拓展训练基地案例｜绳索攀岩模块塔',
  seoDesc:
    '浙江某旅游景区户外拓展训练基地案例：18 米模块化 M 系列训练塔、高空绳索与攀岩集成、完备防坠系统，了解拓之迹景区拓展设施交付。',
  coverImage: 'content/case-zhejiang-outdoor-hero.webp',
  images: [...GALLERY],
  highlights: [
    '景观融合式外观设计，融入景区自然环境与游览动线',
    '高空绳索与攀岩训练集成，兼顾游客体验与专业救援训练',
    '安全护栏与防坠系统完备，降低高空科目组织风险',
    '低维护成本镀锌结构，适配户外长期服役',
  ],
  specs: [
    { label: '塔型', value: '模块化训练塔 · M 系列' },
    { label: '高度', value: '18 米' },
    { label: '功能', value: '拓展 / 绳索 / 攀岩' },
    { label: '安全配置', value: '护栏与防坠系统完备' },
    { label: '结构', value: '低维护镀锌钢结构' },
    { label: '工期', value: '3 个月' },
    { label: '地点', value: '浙江' },
  ],
  description: `## 项目背景

旅游景区管理公司需要在景区内落地一座可服务游客拓展体验、又可支撑专业救援队伍高空训练的设施。场地临近山体与游览动线，既要控制建设周期与运维成本，又要保证外观与景观协调。

客户希望采用模块化训练塔方案，把高空绳索、攀岩与安全防坠纳入同一设施，避免临时道具拼装带来的验收与维护风险。

## 建设方案

方案选用 **模块化训练塔 · M 系列**，高度约 **18 米**，按景区尺度布置平台、绳索线路与攀岩立面，形成「地面导入 → 中高空绳索 → 攀岩/高空作业」的连贯课目链。

![某景区户外拓展训练基地 · 另一外景角度（1/4）](content/case-zhejiang-outdoor-gallery-1.webp)

外观采用景观融合思路：镀锌钢结构本色搭配品牌红护栏点缀，尽量减少对景区天际线的突兀感；地面与周边绿化衔接，便于游客组织与救援训练分时使用。

![某景区户外拓展训练基地 · 仰视全貌（2/4）](content/case-zhejiang-outdoor-gallery-4.webp)

## 核心亮点

### 景观融合式外观

塔体轮廓与色彩按景区环境协调，减少「工业设施突兀感」，便于与游览动线共存，同时保持训练功能清晰可读。

### 高空绳索与攀岩集成

绳索线路与攀岩立面集成于同一模块塔，支持游客拓展体验与专业救援高空科目错峰编排，提高场地利用率。

![某景区户外拓展训练基地 · 护栏与锚点近景（3/4）](content/case-zhejiang-outdoor-gallery-2.webp)

### 安全护栏与防坠完备

平台护栏、防坠与绳索锚点按高空训练安全要求布置，降低组织课目时的临时加装与验收不确定性。

![某景区户外拓展训练基地 · 攀岩与绳索单元（4/4）](content/case-zhejiang-outdoor-gallery-3.webp)

### 低维护镀锌结构

全镀锌钢结构面向户外长期服役，降低全生命周期维护成本，适配景区季节性使用节奏。

## 交付与服务

项目约 **3 个月** 完成：场地与游览动线确认 → 模块组合与安全点位会审 → 制造安装 → 绳索/攀岩联调 → 操作与安全培训。

验收重点包括护栏与防坠完整性、绳索/攀岩可用性，以及景区日常巡检要点移交。

## 项目价值

基地投入使用后，景区可在同一设施兼顾游客拓展体验与专业救援高空训练，缩短多场地切换成本。同类景区项目可优先锁定：景观融合外观、绳索/攀岩集成、防坠系统与镀锌维护边界，再按客流与训练强度调节高度与模块数量。
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
  // 图片前后空行：上一行与下一行应为空（文件边界除外）
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
  console.log('images:', PAYLOAD.images.length);
  console.log('old cover (void):', existing.coverImage);

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
