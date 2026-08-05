/**
 * 按最新 docs/case-center-content-ai-enrichment-plan.md 重做 caseshow-53-76（模板案例）。
 * - 旧图：红蓝集装箱 CFBT（封面/图0，标语「CFBT 烟火特性训练设施」）✅；图1~3 与仁寿案例 MD5 相同 ❌
 * - detailCover：俯视图全景航拍（约 45°~60°），顶面/场地完整，顶部留白
 * - 新图尽量复现标语；无法准确渲染时省略，不留乱码
 * - 无需脱敏：保留锡林郭勒盟消防口径；清除公司模板文案与电话
 * - 验收：curl/HTML，不用浏览器
 *
 * 用法：pnpm --filter @tzj/api exec node --env-file=../../.env ./node_modules/tsx/dist/cli.mjs scripts/enrich-caseshow-53-76.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ANCHOR = {
  slug: 'caseshow-53-76',
  title: '锡林郭勒盟消防训练场',
  client: '锡林郭勒盟消防',
  location: '锡林郭勒盟',
  caseType: 'fire' as const,
  facility: '红蓝集装箱 CFBT 烟火特性训练设施（黄护栏楼梯 + 分层舱室）',
  facadeText: 'CFBT 烟火特性训练设施',
};

const GALLERY = [
  'content/case-caseshow-53-76-gallery-1.webp',
  'content/case-caseshow-53-76-gallery-2.webp',
  'content/case-caseshow-53-76-gallery-3.webp',
] as const;

const PAYLOAD = {
  summary:
    '为锡林郭勒盟消防建设训练场：以红蓝涂装集装箱 CFBT 烟火特性训练设施为主体，配置黄色外挂楼梯与分层舱室，服务烟火特性认知与舱室烟热适应训练。',
  seoTitle: '锡林郭勒盟消防训练场｜集装箱 CFBT 烟火特性训练案例',
  seoDesc:
    '锡林郭勒盟消防训练场案例：红蓝集装箱 CFBT 烟火特性训练设施与分层舱室配置，了解拓之迹消防训练设施交付。',
  coverImage: 'content/case-caseshow-53-76-hero.webp',
  detailCoverImage: 'content/case-caseshow-53-76-detail-hero.webp',
  images: [...GALLERY],
  highlights: [
    '集装箱 CFBT 模块覆盖烟火特性训练科目',
    '红蓝涂装与标牌科目指向清晰，便于组训',
    '黄色外挂楼梯与护栏支持上下通过与观察',
    '分层舱室支持烟热环境适应与进出演练',
  ],
  specs: [
    { label: '设施类型', value: '集装箱 CFBT 训练设施' },
    { label: '典型科目', value: '烟火特性 / 舱室烟热' },
    { label: '结构', value: '集装箱模块化叠层' },
    { label: '安全配置', value: '黄护栏与外挂楼梯' },
    { label: '场地', value: '消防训练场' },
    { label: '地点', value: '锡林郭勒盟' },
    { label: '交付内容', value: '模块安装与安全交底' },
  ],
  description: `## 项目背景

盟市消防单位需要在训练场落地一套可服务烟火特性认知与舱室烟热适应训练的设施。场地以硬化铺装为主，既要控制建设工期与干扰，又要保证模块结构安全与日常巡检简便。

客户希望以成熟集装箱 CFBT 烟火特性训练设施替代临时搭建道具，形成可重复组织的训练科目，覆盖从外场观摩讲解到舱室进出演练的完整链路。

## 建设方案

方案以 **红蓝涂装集装箱 CFBT 烟火特性训练设施** 为主体：集装箱叠层布置，配置黄色外挂楼梯、走道护栏与分层出入口；外立面标示「CFBT 烟火特性训练设施」科目指向，底层保留通行洞口便于场区组织。

![锡林郭勒盟消防训练场 · 另一外景角度（1/3）](content/case-caseshow-53-76-gallery-1.webp)

布局预留设施前方集结与教员观察空间，便于分组轮换，减少对场区车辆与物资动线的干扰。

![锡林郭勒盟消防训练场 · 楼梯舱门近景（2/3）](content/case-caseshow-53-76-gallery-2.webp)

## 核心亮点

### CFBT 科目清晰

集装箱 CFBT 模块覆盖烟火特性训练科目，外立面标牌与分层舱室形成清晰组训路径，便于教员讲解与考核。

### 上下通过安全

黄色外挂楼梯与护栏平台支持上下通过与高处观察，降低组织风险，便于纳入日常安全管理。

![锡林郭勒盟消防训练场 · 舱室内部视角（3/3）](content/case-caseshow-53-76-gallery-3.webp)

### 分层舱室可演练

分层舱室与出入口支持烟热环境适应、进出转换与观察纠错，与外场模块形成内外联动。

### 模块化可维护

集装箱模块化结构便于巡检与局部维护，适配训练场长期室外服役与后续扩展。

## 交付与服务

交付覆盖场地确认、模块吊装安装、护栏验收与安全使用培训。验收重点包括集装箱叠层稳定性、楼梯护栏完好、出入口启闭可靠，以及教员操作与巡检要点移交。

## 项目价值

设施投入使用后，锡林郭勒盟消防可在自有训练场组织烟火特性与舱室烟热训练，降低外租场地成本。同类盟市消防项目可优先锁定：CFBT 模块动线、护栏安全边界、舱室维护路径，再按课表频次扩展科目单元。
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
    '仁寿',
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
