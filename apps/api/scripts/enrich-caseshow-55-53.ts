/**
 * 按最新 docs/case-center-content-ai-enrichment-plan.md 重做 caseshow-55-53（模板案例）。
 * - 旧图：橙攀岩墙+蓝高空钢架（图1）与「拓展训练基地」✅；障碍器械（图2）同场辅助；绿训练塔（封面）偏警消塔型 ❌
 * - detailCover：高角度斜俯拍（非正俯视），底部与地面完整入画，顶部留白
 * - 无需脱敏：保留石嘴山石崖子口径；清除公司模板文案与电话
 * - 验收：curl/HTML，不用浏览器
 *
 * 用法：pnpm --filter @tzj/api exec node --env-file=../../.env ./node_modules/tsx/dist/cli.mjs scripts/enrich-caseshow-55-53.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ANCHOR = {
  slug: 'caseshow-55-53',
  title: '石嘴山石崖子拓展训练基地',
  client: '石嘴山石崖子',
  location: '石嘴山',
  caseType: 'scenic' as const,
  facility: '户外拓展攀岩墙（橙色立面）+ 蓝色高空钢构架 · 景区/拓展场地',
};

const GALLERY = [
  'content/case-caseshow-55-53-gallery-1.webp',
  'content/case-caseshow-55-53-gallery-2.webp',
  'content/case-caseshow-55-53-gallery-3.webp',
] as const;

const PAYLOAD = {
  summary:
    '为石嘴山石崖子建设户外拓展训练基地：以橙色攀岩墙与蓝色高空钢构架组合为主体，服务团队拓展、攀爬通过与高空科目训练，适配山地景区户外场地长期使用。',
  seoTitle: '石嘴山石崖子拓展训练基地｜户外攀岩墙与高空架案例',
  seoDesc:
    '石嘴山石崖子拓展训练基地案例：橙色攀岩墙、蓝色高空钢构架与户外拓展场地布置，了解拓之迹景区拓展设施交付。',
  coverImage: 'content/case-caseshow-55-53-hero.webp',
  detailCoverImage: 'content/case-caseshow-55-53-detail-hero.webp',
  images: [...GALLERY],
  highlights: [
    '橙色攀岩墙覆盖基础攀爬与通过类拓展科目',
    '蓝色高空钢构架支持高空绳索与平台科目',
    '砂石铺装场地便于集结轮换与排水维护',
    '山地景区环境适配户外拓展长期运营',
  ],
  specs: [
    { label: '设施类型', value: '户外拓展攀岩墙' },
    { label: '典型科目', value: '攀岩墙 / 高空通过' },
    { label: '结构', value: '攀岩立面 + 高空钢构' },
    { label: '安全配置', value: '平台护栏与钢架防护' },
    { label: '场地', value: '景区户外拓展场' },
    { label: '地点', value: '石嘴山' },
    { label: '交付内容', value: '器械安装与安全交底' },
  ],
  description: `## 项目背景

景区拓展场地需要落地一套可服务团队拓展、攀爬通过与高空科目训练的户外设施。场地以砂石铺装为主、三面环山绿化，既要控制建设干扰，又要保证高空钢构安全与日常巡检简便。

客户希望以成熟攀岩墙与高空钢构架组合替代临时道具，形成可重复组织的拓展课表，并避免堆叠与景区场景不符的重型消防训练塔。

## 建设方案

方案以 **橙色攀岩墙 + 蓝色高空钢构架** 为主体：攀岩立面提供攀爬通过路径，蓝色钢架形成高空平台与绳索科目空间；整体落位于山地景区户外砂石拓展场，预留前方集结与教员观察区域。

![石嘴山石崖子拓展训练基地 · 另一外景角度（1/3）](content/case-caseshow-55-53-gallery-1.webp)

布局兼顾山地排水与通行动线，减少对景区步道与后勤通道的干扰，便于分组轮换。

![石嘴山石崖子拓展训练基地 · 墙体钢架近景（2/3）](content/case-caseshow-55-53-gallery-2.webp)

## 核心亮点

### 攀岩墙科目清晰

橙色攀岩立面覆盖基础攀爬与通过类拓展科目，便于形成标准课表与教员示范路径。

### 高空钢构可组训

蓝色高空钢构架支持平台通过与绳索类科目，教员可在地面或平台侧组织观察与纠错。

![石嘴山石崖子拓展训练基地 · 仰视高空视角（3/3）](content/case-caseshow-55-53-gallery-3.webp)

### 场地维护简便

砂石铺装场地便于集结轮换与排水维护，适配景区户外长期运营与季节性客流。

### 山地环境融合

设施尺度与山地景区环境协调，避免引入与拓展场景不符的重型塔体，降低视觉与建设干扰。

## 交付与服务

交付覆盖场地确认、器械安装、护栏验收与安全使用培训。验收重点包括攀岩墙与钢构稳定性、平台护栏完好，以及教员操作与巡检要点移交。

## 项目价值

设施投入使用后，石崖子可在自有场地组织团队拓展与攀爬高空训练，提升景区研学与团建承载能力。同类景区项目可优先锁定：攀岩墙与高空架动线、护栏安全边界、户外钢构维护路径，再按客流频次扩展器械组合。
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
