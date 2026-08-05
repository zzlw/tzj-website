/**
 * 按最新 docs/case-center-content-ai-enrichment-plan.md 重做 caseshow-57-66（模板案例）。
 * - 旧图：封面/图1 为同套悬吊踏步器械 ✅ 作参考；图2 另一结构 ❌ 作废
 * - 标题含真实品牌「三只松鼠」→ 匿名化；清除公司模板文案与电话
 *
 * 用法：pnpm --filter @tzj/api exec node --env-file=../../.env ./node_modules/tsx/dist/cli.mjs scripts/enrich-caseshow-57-66.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ANCHOR = {
  slug: 'caseshow-57-66',
  /** 匿名化后标题（原标题含真实品牌，按合规改写） */
  title: '安徽某企业拓展训练基地',
  client: '某食品企业',
  location: '安徽',
  caseType: 'enterprise' as const,
  facility: '户外拓展训练器械（悬吊踏步/平衡协调）· 企业园区场地',
};

const GALLERY = [
  'content/case-caseshow-57-66-gallery-1.webp',
  'content/case-caseshow-57-66-gallery-2.webp',
  'content/case-caseshow-57-66-gallery-3.webp',
] as const;

const PAYLOAD = {
  summary:
    '为安徽某食品企业园区建设户外拓展训练设施：以悬吊踏步等钢构拓展器械为主体，服务员工团建与基础协调训练，兼顾场地安全垫面与日常维护便利。',
  seoTitle: '安徽企业拓展训练基地案例｜户外悬吊踏步器械',
  seoDesc:
    '安徽某食品企业拓展训练基地案例：户外悬吊踏步与平衡协调器械、园区场地布置，了解拓之迹企业拓展设施交付。',
  coverImage: 'content/case-caseshow-57-66-hero.webp',
  detailCoverImage: 'content/case-caseshow-57-66-detail-hero.webp',
  images: [...GALLERY],
  highlights: [
    '悬吊踏步器械覆盖平衡与协调性训练科目',
    '钢构户外器械适配企业园区长期室外使用',
    '砂垫面与器械布置降低落地冲击风险',
    '模块化器械便于巡检维护与局部更换',
  ],
  specs: [
    { label: '设施类型', value: '户外拓展器械' },
    { label: '典型科目', value: '悬吊踏步 / 平衡协调' },
    { label: '结构', value: '钢构户外器械' },
    { label: '场地', value: '企业园区户外场地' },
    { label: '安全配置', value: '砂垫面与器械防护' },
    { label: '地点', value: '安徽' },
  ],
  description: `## 项目背景

食品企业园区需要在办公区周边落地一套可服务员工团建与基础体能协调训练的户外拓展设施。场地临近停车与绿地区域，既要控制建设干扰，又要保证器械安全与日常维护简便。

客户希望以成熟户外拓展器械组合替代临时道具，形成可重复组织的训练科目，并避免在园区内堆叠与企业场景不符的重型训练塔。

## 建设方案

方案以 **悬吊踏步类钢构拓展器械** 为主体：蓝色钢框架承重，链吊圆柱踏步单元沿纵轴排列，下方设置砂垫面；整体嵌入园区草坪与步道之间，服务平衡、协调与团队通过类科目。

![安徽某企业拓展训练基地 · 另一外景角度（1/3）](content/case-caseshow-57-66-gallery-1.webp)

布局上预留器械两侧通行与集结空间，便于教员组织与分组轮换，减少对园区停车与主出入口的干扰。

![安徽某企业拓展训练基地 · 器械结构近景（2/3）](content/case-caseshow-57-66-gallery-2.webp)

## 核心亮点

### 悬吊踏步科目清晰

链吊圆柱踏步形成连续通过路径，覆盖平衡与协调性训练，适合团建导入与基础体能课目编排。

### 钢构户外耐久

钢构户外器械适配企业园区长期室外服役，便于巡检与局部更换，降低全生命周期维护负担。

![安徽某企业拓展训练基地 · 纵轴视角（3/3）](content/case-caseshow-57-66-gallery-3.webp)

### 砂垫面安全缓冲

器械下方砂垫面与周边草坪衔接，降低落地冲击风险，便于园区日常清扫与季节性维护。

### 园区场景友好

设施尺度与企业园区环境协调，避免重型训练塔对场地与动线的过度占用，便于与团建活动错峰组织。

## 交付与服务

交付覆盖场地确认、器械安装、砂垫面整理与安全使用培训。验收重点包括框架稳定性、吊点与踏步单元完好、砂垫面覆盖，以及教员操作与巡检要点移交。

## 项目价值

设施投入使用后，企业可在园区内组织员工拓展与基础协调训练，降低外租场地成本。同类企业园区项目可优先锁定：科目与器械匹配、砂垫面安全边界、户外钢构维护路径，再按团建频次扩展器械组合。
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
    '三只松鼠',
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
      ANCHOR.client,
    ].join('\n'),
  );

  const descLen = description.replace(/\s/g, '').length;
  console.log('old title:', existing.title);
  console.log('new title (anonymized):', ANCHOR.title);
  console.log('anchor facility:', ANCHOR.facility);
  console.log('description chars (no whitespace):', descLen);
  console.log('old cover (void dirty set):', existing.coverImage);

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
      // 完成时间无可靠出处，保持 null
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
