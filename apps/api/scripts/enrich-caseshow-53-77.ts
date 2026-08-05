/**
 * 按最新 docs/case-center-content-ai-enrichment-plan.md 重做 caseshow-53-77（模板案例）。
 * - 旧图：集装箱烟火特性训练设施（封面/图0，标语「烟火特性训练」）✅；烟热训练室内部（图2）✅；网笼仓储 ❌
 * - 新图尽量复现外墙标语「烟火特性训练」；内部无法准确渲染文字时省略（不留乱码）
 * - 无需脱敏：保留仁寿消防口径；清除公司模板文案与电话
 * - detailCover：远景/航拍 + 顶部留白；验收用 curl/HTML
 *
 * 用法：pnpm --filter @tzj/api exec node --env-file=../../.env ./node_modules/tsx/dist/cli.mjs scripts/enrich-caseshow-53-77.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ANCHOR = {
  slug: 'caseshow-53-77',
  title: '仁寿消防训练基地',
  client: '仁寿消防',
  location: '仁寿',
  caseType: 'fire' as const,
  facility: '集装箱模块化烟火特性训练设施（深灰集装箱 + 黄护栏楼梯）+ 多功能烟热训练室',
  facadeText: '烟火特性训练',
};

const GALLERY = [
  'content/case-caseshow-53-77-gallery-1.webp',
  'content/case-caseshow-53-77-gallery-2.webp',
  'content/case-caseshow-53-77-gallery-3.webp',
] as const;

const PAYLOAD = {
  summary:
    '为仁寿消防建设烟火特性训练基地：以深灰集装箱模块化训练设施为主体，配置黄色外挂楼梯与护栏平台，并配套多功能烟热训练室，服务烟火特性认知与烟热环境适应训练。',
  seoTitle: '仁寿消防训练基地｜集装箱烟火特性训练设施案例',
  seoDesc:
    '仁寿消防训练基地案例：集装箱模块化烟火特性训练设施与多功能烟热训练室，了解拓之迹消防训练设施交付。',
  coverImage: 'content/case-caseshow-53-77-hero.webp',
  detailCoverImage: 'content/case-caseshow-53-77-detail-hero.webp',
  images: [...GALLERY],
  highlights: [
    '集装箱模块化结构便于场地快速落地与扩展',
    '烟火特性训练外立面科目指向清晰，便于组训',
    '黄色外挂楼梯与护栏平台支持上下通过与观察',
    '配套多功能烟热训练室覆盖烟热环境适应科目',
  ],
  specs: [
    { label: '设施类型', value: '集装箱烟火特性训练设施' },
    { label: '典型科目', value: '烟火特性 / 烟热适应' },
    { label: '结构', value: '集装箱模块化叠层' },
    { label: '安全配置', value: '黄护栏与外挂楼梯' },
    { label: '辅助单元', value: '多功能烟热训练室' },
    { label: '场地', value: '消防训练场' },
    { label: '地点', value: '仁寿' },
    { label: '交付内容', value: '模块安装与安全交底' },
  ],
  description: `## 项目背景

基层消防单位需要在有限训练场落地一套可服务烟火特性认知与烟热环境适应训练的设施。场地以硬化铺装为主，既要控制建设工期与干扰，又要保证模块结构安全与日常巡检简便。

客户希望以成熟集装箱模块化训练设施替代临时搭建道具，形成可重复组织的训练科目，并配套室内烟热训练单元，覆盖从外场观摩到内场适应的完整链路。

## 建设方案

方案以 **深灰集装箱模块化烟火特性训练设施** 为主体：集装箱叠层布置，配置黄色外挂楼梯、走道护栏与分层出入口；外立面标示「烟火特性训练」科目指向。室内配套多功能烟热训练室，以蜂窝网状模块与暖色内舱形成烟热环境空间。

![仁寿消防训练基地 · 另一外景角度（1/3）](content/case-caseshow-53-77-gallery-1.webp)

布局预留设施前方集结与教员观察空间，便于分组轮换，减少对场区车辆与物资动线的干扰。

![仁寿消防训练基地 · 楼梯护栏近景（2/3）](content/case-caseshow-53-77-gallery-2.webp)

## 核心亮点

### 模块化落地快

集装箱模块化结构便于在硬化场地上快速安装与后续扩展，降低土建依赖，适合基层训练场分阶段投入。

### 科目指向清晰

外立面「烟火特性训练」标识与分层出入口形成清晰组训路径，便于教员组织观摩、讲解与考核。

![仁寿消防训练基地 · 烟热训练室内部（3/3）](content/case-caseshow-53-77-gallery-3.webp)

### 上下通过安全

黄色外挂楼梯与护栏平台支持上下通过与高处观察，降低组织风险，便于纳入日常安全管理。

### 烟热室内配套

多功能烟热训练室以蜂窝网状模块与内舱空间覆盖烟热环境适应科目，与外场集装箱设施形成内外联动。

## 交付与服务

交付覆盖场地确认、模块吊装安装、护栏验收与安全使用培训。验收重点包括集装箱叠层稳定性、楼梯护栏完好、出入口启闭可靠，以及烟热训练室模块完整性与教员操作要点移交。

## 项目价值

设施投入使用后，仁寿消防可在自有场地组织烟火特性与烟热适应训练，降低外租场地成本。同类基层消防项目可优先锁定：集装箱叠层动线、护栏安全边界、烟热室内模块维护路径，再按课表频次扩展科目单元。
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
    '郑州',
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
  console.log('facade text:', ANCHOR.facadeText);
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
