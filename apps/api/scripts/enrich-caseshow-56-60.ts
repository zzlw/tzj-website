/**
 * 按最新 docs/case-center-content-ai-enrichment-plan.md 重做 caseshow-56-60（模板案例）。
 * - 旧图：黄攀岩墙+白钢架（封面/图0/图2）✅ 作参考；蓝白多层训练塔 ❌ 作废
 * - 按方案「无需脱敏」保留宁夏工商职业学院口径；清除公司模板文案与电话
 * - detailCover：远景/航拍 + 顶部留白（导航安全区）
 *
 * 用法：pnpm --filter @tzj/api exec node --env-file=../../.env ./node_modules/tsx/dist/cli.mjs scripts/enrich-caseshow-56-60.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ANCHOR = {
  slug: 'caseshow-56-60',
  title: '宁夏工商职业学院拓展训练基地',
  client: '宁夏工商职业学院',
  location: '宁夏',
  caseType: 'school' as const,
  facility: '户外拓展攀岩墙（黄色攀岩面 + 白色钢架）· 院校户外训练场',
};

const GALLERY = [
  'content/case-caseshow-56-60-gallery-1.webp',
  'content/case-caseshow-56-60-gallery-2.webp',
  'content/case-caseshow-56-60-gallery-3.webp',
] as const;

const PAYLOAD = {
  summary:
    '为宁夏工商职业学院建设户外拓展训练基地：以黄色攀岩墙与白色钢构平台组合为主体，配套绳索架与低矮通过墙，服务学生拓展与基础攀爬通过训练。',
  seoTitle: '宁夏工商职业学院拓展训练基地｜户外攀岩墙案例',
  seoDesc:
    '宁夏工商职业学院拓展训练基地案例：户外攀岩墙、钢构平台与绳索架组合，了解拓之迹院校拓展设施交付。',
  coverImage: 'content/case-caseshow-56-60-hero.webp',
  detailCoverImage: 'content/case-caseshow-56-60-detail-hero.webp',
  images: [...GALLERY],
  highlights: [
    '黄色攀岩墙覆盖基础攀爬与通过类拓展科目',
    '白色钢构平台与护栏便于教员组织观察',
    '绳索架与低矮通过墙形成组合训练动线',
    '户外钢构适配院校场地长期室外使用',
  ],
  specs: [
    { label: '设施类型', value: '户外拓展攀岩墙' },
    { label: '典型科目', value: '攀岩墙 / 绳索 / 通过墙' },
    { label: '结构', value: '钢构攀岩面与平台' },
    { label: '安全配置', value: '护栏与场地警示' },
    { label: '场地', value: '院校户外训练场' },
    { label: '地点', value: '宁夏' },
    { label: '交付内容', value: '器械安装与安全交底' },
  ],
  description: `## 项目背景

职业院校需要在校园户外场地落地一套可服务学生拓展、团建与基础攀爬通过训练的设施。场地开阔、临近运动场与绿化带，既要控制建设干扰，又要保证高空平台安全与日常巡检简便。

客户希望以成熟攀岩墙与钢构平台组合替代临时道具，形成可重复组织的训练科目，并避免堆叠与院校场景不符的重型消防训练塔。

## 建设方案

方案以 **黄色攀岩墙 + 白色钢构平台** 为主体：墙面布置攀岩支点，背面与侧向白色钢架承重并形成顶部平台；配套深色绳索架与低矮黄色通过墙，整体落位于院校户外硬质铺装训练场。

![宁夏工商职业学院拓展训练基地 · 另一外景角度（1/3）](content/case-caseshow-56-60-gallery-1.webp)

布局预留器械前方集结与教员观察空间，便于分组轮换，减少对运动场与校园主路动线的干扰。

![宁夏工商职业学院拓展训练基地 · 墙体与钢架近景（2/3）](content/case-caseshow-56-60-gallery-2.webp)

## 核心亮点

### 攀岩墙科目清晰

黄色攀岩立面与支点布置覆盖基础攀爬与通过类拓展科目，便于形成标准课表与教员示范路径。

### 钢构平台便于组织

白色钢构平台与护栏支持上下通过与观察指导，教员可在平台侧组织与纠错，提高课目可控性。

![宁夏工商职业学院拓展训练基地 · 仰视平台视角（3/3）](content/case-caseshow-56-60-gallery-3.webp)

### 组合器械动线完整

绳索架与低矮通过墙与主攀岩墙形成组合训练动线，适合导入课与分组轮换，提升场地利用率。

### 户外钢构可维护

钢构户外器械适配院校场地长期室外服役，便于巡检与局部维护，降低全生命周期运维负担。

## 交付与服务

交付覆盖场地确认、器械安装、护栏验收与安全使用培训。验收重点包括墙体/平台稳定性、护栏完好、警示标识齐套，以及教员操作与巡检要点移交。

## 项目价值

设施投入使用后，学院可在自有场地组织学生拓展与基础攀爬训练，降低外租场地成本。同类院校项目可优先锁定：攀岩墙与平台动线、护栏安全边界、户外钢构维护路径，再按课表频次扩展器械组合。
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

function assertNoTemplateResidue(text: string): void {
  const blacklist = [
    '专业拓展器材生产厂家',
    '为广大客户',
    '河南拓之迹实业有限公司',
    '0371-58691119',
    '拓之迹丨',
  ];
  for (const w of blacklist) {
    if (text.includes(w)) throw new Error(`模板/敏感残留: ${w}`);
  }
}

async function main() {
  const existing = await prisma.case.findUnique({ where: { slug: ANCHOR.slug } });
  if (!existing) {
    console.error(`missing slug: ${ANCHOR.slug}`);
    process.exit(1);
  }
  if (existing.caseType !== ANCHOR.caseType) {
    console.error('caseType 偏离，中止:', existing.caseType);
    process.exit(1);
  }

  const description = PAYLOAD.description.trim();
  assertMarkdownSpacing(description);
  assertEmbeddedGallery(description, PAYLOAD.images);
  assertNoTemplateResidue(
    [PAYLOAD.summary, PAYLOAD.seoTitle, PAYLOAD.seoDesc, description, ANCHOR.title, ANCHOR.client ?? ''].join(
      '\n',
    ),
  );

  const descLen = description.replace(/\s/g, '').length;
  console.log('old title:', existing.title);
  console.log('new title:', ANCHOR.title);
  console.log('anchor facility:', ANCHOR.facility);
  console.log('description chars (no whitespace):', descLen);

  if (descLen < 800 || descLen > 1200) {
    console.warn(`description length ${descLen} outside 800~1200 window`);
  }

  await prisma.case.update({
    where: { slug: ANCHOR.slug },
    data: {
      title: ANCHOR.title,
      client: ANCHOR.client,
      location: ANCHOR.location,
      summary: PAYLOAD.summary,
      seoTitle: PAYLOAD.seoTitle,
      seoDesc: PAYLOAD.seoDesc,
      coverImage: PAYLOAD.coverImage,
      detailCoverImage: PAYLOAD.detailCoverImage,
      images: PAYLOAD.images,
      highlights: PAYLOAD.highlights,
      specs: PAYLOAD.specs,
      description,
      completionDate: null,
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
