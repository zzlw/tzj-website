/**
 * 按最新 docs/case-center-content-ai-enrichment-plan.md 复核升级 guangdong-cfbt。
 *
 * 用法：pnpm --filter @tzj/api exec node --env-file=../../.env ./node_modules/tsx/dist/cli.mjs scripts/enrich-guangdong-cfbt.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ANCHOR = {
  slug: 'guangdong-cfbt',
  title: '某消防救援支队 CFBT 训练中心',
  client: '某市消防救援支队',
  location: '广东',
  caseType: 'fire' as const,
  facility: '固定训练塔 + 3 间互锁衬里燃烧室 + 热烟系统；约 1100°C；NFPA 1402 实践参考',
};

const GALLERY = [
  'content/case-guangdong-cfbt-gallery-1.webp',
  'content/case-guangdong-cfbt-gallery-2.webp',
  'content/case-guangdong-cfbt-gallery-3.webp',
  'content/case-guangdong-cfbt-gallery-4.webp',
] as const;

const PAYLOAD = {
  summary:
    '建设华南地区重点 CFBT（实火训练）中心：固定训练塔与互锁隔热衬里燃烧室组合，配套热烟训练系统，服务支队实战化训练与区域协作演练。',
  seoTitle: '广东消防支队 CFBT 训练中心案例｜互锁衬里燃烧室',
  seoDesc:
    '广东消防救援支队 CFBT 训练中心案例：互锁隔热衬里燃烧室、热烟系统与固定塔组合，了解拓之迹实火训练设施交付。',
  coverImage: 'content/case-guangdong-cfbt-hero.webp',
  detailCoverImage: 'content/case-guangdong-cfbt-detail-hero.webp',
  images: [...GALLERY],
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

支队实战化训练对 CFBT / 热烟科目依赖度高，既要温度与烟气可控，又要能与塔内搜救、破拆动线衔接。

客户希望建成区域可用的实火训练中心，支撑本支队日常课目与协作演练，并保证衬里可巡检、可局部更换，降低高频使用下的停训风险。

## 建设方案

方案以固定训练塔为外沿结构骨架，核心能力落在 **3 间互锁隔热衬里燃烧室** 与热烟系统。塔室组合保证学员从热环境过渡到搜救/破拆科目时动线连续。

![某消防救援支队 CFBT 训练中心 · 外景全景（1/4）](content/case-guangdong-cfbt-gallery-1.webp)

设施呈现「黑色网孔训练塔 + 黑色波纹燃烧室楼体」一体布局，红色护栏与管线统一安全识别色，观察与进出路径按教员控制习惯布置。

![某消防救援支队 CFBT 训练中心 · 训练塔侧视角（2/4）](content/case-guangdong-cfbt-gallery-2.webp)

## 核心亮点

### 互锁隔热衬里高温工况

互锁隔热衬里面向约 **1100°C** 工况温度与高频 CFBT 使用，空舱交接时可直观检查衬里接缝与舱门状态。

![某消防救援支队 CFBT 训练中心 · 燃烧室楼体与舱门（3/4）](content/case-guangdong-cfbt-gallery-3.webp)

### 燃烧模式灵活编排

燃烧模式可灵活布置，覆盖不同热烟与搜救课目组合，避免「一室一课」僵化，支持分班轮换。

![某消防救援支队 CFBT 训练中心 · 燃烧室内部（4/4）](content/case-guangdong-cfbt-gallery-4.webp)

### 衬里模块化可更换

衬里模块化便于巡检与局部更换，降低整场停训概率，把可维护性写入验收标准。

### 参照训练设施实践要求

设施设计参考 NFPA 1402 训练设施相关实践要求，便于支队将中心纳入实战化训练与协作演练体系。

## 交付与服务

项目周期约 **10 个月**。关键节点包括：科目与热负荷确认 → 塔室一体设计与安全联锁会审 → 衬里与燃烧室制造安装 → 热烟系统联调 → 教员实操与维保培训。

验收以「可排课、可巡检、可更换」为通过标准，而不只看外观完工。

## 项目价值

中心投入使用后，支队可在可控热烟环境中稳定开展 CFBT 相关课目，并与塔内搜救训练衔接。同类华南湿热地区项目，建议优先锁定：互锁衬里规格、更换路径、热烟联调责任界面，再扩展燃烧室数量。
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
  console.log('cover/detail/images:', PAYLOAD.coverImage, PAYLOAD.detailCoverImage, PAYLOAD.images.length);

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
