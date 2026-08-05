/**
 * 按最新 docs/case-center-content-ai-enrichment-plan.md 重做 caseshow-56-58（模板案例）。
 * - 旧图：蓝白多层攀登训练塔（封面/图0）与「湖南警校」✅ 作参考；黄攀岩墙跨案例复用 ❌ 作废
 * - 按方案「无需脱敏」保留湖南警校口径；清除公司模板文案与电话
 * - detailCover：远景/航拍 + 顶部留白（导航安全区）
 * - 验收：curl/HTML，不用浏览器自动化
 *
 * 用法：pnpm --filter @tzj/api exec node --env-file=../../.env ./node_modules/tsx/dist/cli.mjs scripts/enrich-caseshow-56-58.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ANCHOR = {
  slug: 'caseshow-56-58',
  title: '湖南警校训练基地',
  client: '湖南警校',
  location: '湖南',
  caseType: 'school' as const,
  facility: '多层攀登训练塔（蓝白涂装 + 窗洞/外挂楼梯）· 警校训练场',
};

const GALLERY = [
  'content/case-caseshow-56-58-gallery-1.webp',
  'content/case-caseshow-56-58-gallery-2.webp',
  'content/case-caseshow-56-58-gallery-3.webp',
] as const;

const PAYLOAD = {
  summary:
    '为湖南警校建设攀登训练基地：以蓝白涂装多层固定训练塔为主体，设置分层窗洞、外挂楼梯与顶部平台，服务攀登、绳索与高空通过类科目训练。',
  seoTitle: '湖南警校训练基地｜多层攀登训练塔案例',
  seoDesc:
    '湖南警校训练基地案例：多层攀登训练塔、分层窗洞与外挂楼梯配置，了解拓之迹警校训练设施交付。',
  coverImage: 'content/case-caseshow-56-58-hero.webp',
  detailCoverImage: 'content/case-caseshow-56-58-detail-hero.webp',
  images: [...GALLERY],
  highlights: [
    '多层固定训练塔覆盖攀登与高空通过科目',
    '分层窗洞便于绳索垂降与窗台突入演练',
    '外挂楼梯与顶部平台支持教员组织观察',
    '钢混/钢构组合适配警校场地长期使用',
  ],
  specs: [
    { label: '设施类型', value: '多层攀登训练塔' },
    { label: '典型科目', value: '攀登 / 绳索 / 高空通过' },
    { label: '结构', value: '固定塔 + 分层窗洞' },
    { label: '安全配置', value: '护栏与外挂楼梯' },
    { label: '场地', value: '警校户外训练场' },
    { label: '地点', value: '湖南' },
    { label: '交付内容', value: '塔体安装与安全交底' },
  ],
  description: `## 项目背景

警校需要在校园训练场落地一套可服务学员攀登、绳索与高空通过训练的固定设施。场地临近教学区与生活区，既要控制建设干扰，又要保证塔体结构安全与日常巡检简便。

客户希望以成熟多层攀登训练塔替代临时脚手架道具，形成可重复组织的训练科目，并避免与警校场景不符的重型燃烧实火模块。

## 建设方案

方案以 **蓝白涂装多层固定训练塔** 为主体：塔体设置分层开放窗洞，侧向布置外挂钢梯与护栏，顶部形成带护栏平台；整体落位于警校户外训练场，服务攀登、绳索垂降与窗台突入类科目。

![湖南警校训练基地 · 另一外景角度（1/3）](content/case-caseshow-56-58-gallery-1.webp)

布局预留塔体前方集结与教员观察空间，便于分组轮换，减少对校园主路与教学楼动线的干扰。

![湖南警校训练基地 · 窗洞与墙体近景（2/3）](content/case-caseshow-56-58-gallery-2.webp)

## 核心亮点

### 多层塔体科目清晰

固定多层塔体覆盖攀登与高空通过类科目，便于形成标准课表与教员示范路径，支撑警校日常体能与战术基础训练。

### 分层窗洞便于演练

分层开放窗洞支持绳索垂降、窗台突入与楼层转换演练，教员可在外挂楼梯或地面组织观察与纠错。

![湖南警校训练基地 · 仰视塔体视角（3/3）](content/case-caseshow-56-58-gallery-3.webp)

### 外挂楼梯与平台完备

外挂楼梯与顶部护栏平台便于上下通过与高空观察，降低组织风险，便于纳入警校安全管理流程。

### 户外结构可维护

塔体结构适配警校场地长期室外服役，便于巡检与局部维护，降低全生命周期运维负担。

## 交付与服务

交付覆盖场地确认、塔体安装、护栏验收与安全使用培训。验收重点包括塔体稳定性、窗洞边缘防护、外挂楼梯与顶部护栏完好，以及教员操作与巡检要点移交。

## 项目价值

设施投入使用后，警校可在自有场地组织攀登与高空通过训练，降低外租场地成本。同类院校项目可优先锁定：塔体窗洞动线、外挂楼梯安全边界、户外结构维护路径，再按课表频次扩展辅助器械。
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
