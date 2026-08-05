/**
 * 按最新 docs/case-center-content-ai-enrichment-plan.md 重做 caseshow-57-61（模板案例）。
 * - 旧图：黄白攀爬墙（封面/图1）✅ 作参考；蓝色悬吊踏步为跨案例复用 ❌ 作废
 * - 标题含真实品牌「美的集团」→ 匿名化；清除公司模板文案与电话
 * - detailCover：远景/航拍 + 顶部留白（导航安全区）
 *
 * 用法：pnpm --filter @tzj/api exec node --env-file=../../.env ./node_modules/tsx/dist/cli.mjs scripts/enrich-caseshow-57-61.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ANCHOR = {
  slug: 'caseshow-57-61',
  title: '某家电企业拓展训练基地',
  client: '某家电企业',
  location: null as string | null,
  caseType: 'enterprise' as const,
  facility: '户外拓展攀爬器械（黄色攀爬墙 + 平台楼梯）· 企业户外训练场',
};

const GALLERY = [
  'content/case-caseshow-57-61-gallery-1.webp',
  'content/case-caseshow-57-61-gallery-2.webp',
  'content/case-caseshow-57-61-gallery-3.webp',
] as const;

const PAYLOAD = {
  summary:
    '为某家电企业建设户外拓展训练设施：以钢构攀爬墙与高空平台楼梯组合为主体，服务员工团建与基础攀爬通过训练，兼顾护栏防护与日常维护便利。',
  seoTitle: '家电企业拓展训练基地案例｜户外攀爬墙与平台',
  seoDesc:
    '某家电企业拓展训练基地案例：户外攀爬墙、高空平台与钢构楼梯组合，了解拓之迹企业拓展设施交付。',
  coverImage: 'content/case-caseshow-57-61-hero.webp',
  detailCoverImage: 'content/case-caseshow-57-61-detail-hero.webp',
  images: [...GALLERY],
  highlights: [
    '攀爬墙覆盖基础攀爬与通过类团建科目',
    '高空平台与楼梯组合，便于教员组织与观察',
    '护栏与警示布置降低高空科目组织风险',
    '钢构户外器械适配企业场地长期室外使用',
  ],
  specs: [
    { label: '设施类型', value: '户外拓展攀爬器械' },
    { label: '典型科目', value: '攀爬墙 / 平台通过' },
    { label: '结构', value: '钢构墙体与平台楼梯' },
    { label: '安全配置', value: '护栏与警示标识' },
    { label: '场地', value: '企业户外训练场' },
    { label: '交付内容', value: '器械安装与安全交底' },
  ],
  description: `## 项目背景

家电企业需要在厂区或园区户外场地落地一套可服务员工团建与基础攀爬通过训练的拓展设施。场地开阔、临近围栏与仓储建筑，既要控制建设干扰，又要保证高空平台安全与日常巡检简便。

客户希望以成熟攀爬墙与平台楼梯组合替代临时道具，形成可重复组织的训练科目，并避免堆叠与企业场景不符的重型训练塔。

## 建设方案

方案以 **黄色钢构攀爬墙 + 白色高空平台与楼梯** 为主体：墙体提供攀爬立面，平台与楼梯形成上下通过路径，护栏沿楼梯与平台周圈布置；整体落位于企业户外训练场砂土/草坪区域。

![某家电企业拓展训练基地 · 另一外景角度（1/3）](content/case-caseshow-57-61-gallery-1.webp)

布局预留器械前方集结与教员观察空间，便于分组轮换，减少对厂区物流动线的干扰。

![某家电企业拓展训练基地 · 墙体与护栏近景（2/3）](content/case-caseshow-57-61-gallery-2.webp)

## 核心亮点

### 攀爬墙科目清晰

波纹钢构攀爬立面覆盖基础攀爬与通过类团建科目，便于形成标准课表与教员示范路径。

### 平台楼梯便于组织

高空平台与楼梯组合支持上下通过与观察指导，教员可在平台侧组织与纠错，提高课目可控性。

![某家电企业拓展训练基地 · 楼梯与平台视角（3/3）](content/case-caseshow-57-61-gallery-3.webp)

### 护栏与警示完备

楼梯与平台周圈护栏、场地警示标识降低高空科目组织风险，便于纳入企业安全管理流程。

### 户外钢构可维护

钢构户外器械适配企业场地长期室外服役，便于巡检与局部维护，降低全生命周期运维负担。

## 交付与服务

交付覆盖场地确认、器械安装、护栏验收与安全使用培训。验收重点包括墙体/平台稳定性、护栏完好、警示标识齐套，以及教员操作与巡检要点移交。

## 项目价值

设施投入使用后，企业可在自有场地组织员工拓展与基础攀爬训练，降低外租场地成本。同类企业项目可优先锁定：攀爬墙与平台动线、护栏安全边界、户外钢构维护路径，再按团建频次扩展器械组合。
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
    '美的集团',
    '美的',
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
    [
      PAYLOAD.summary,
      PAYLOAD.seoTitle,
      PAYLOAD.seoDesc,
      description,
      ANCHOR.title,
      ANCHOR.client ?? '',
    ].join('\n'),
  );

  const descLen = description.replace(/\s/g, '').length;
  console.log('old title:', existing.title);
  console.log('new title (anonymized):', ANCHOR.title);
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
