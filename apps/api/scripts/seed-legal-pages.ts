/**
 * 法务页面正文初始化脚本：将 C 端内置 i18n 文案（privacy/terms × zh-CN/zh-TW/en）
 * 组装为 Markdown 写入 pages 表，供 admin「法务页面」编辑、C 端优先读取。
 *
 * 用法：
 *   pnpm --filter @tzj/api exec tsx scripts/seed-legal-pages.ts           # 仅填充缺失/空白的记录
 *   pnpm --filter @tzj/api exec tsx scripts/seed-legal-pages.ts --force   # 覆盖已有正文（慎用）
 *
 * slug 约定与 C 端 getLegalPage / admin legal-pages 一致：`{key}-{locale}`。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FORCE = process.argv.includes('--force');

/** C 端 i18n 消息目录（monorepo 内相对本脚本定位） */
const MESSAGES_DIR = join(__dirname, '../../web/src/messages');

const LOCALES = [
  { id: 'zh-CN', label: '简体中文' },
  { id: 'zh-TW', label: '繁體中文' },
  { id: 'en', label: 'English' },
] as const;

const LEGAL_PAGES = [
  { key: 'privacy', labels: { 'zh-CN': '隐私政策', 'zh-TW': '隱私政策', en: 'Privacy Policy' } },
  { key: 'terms', labels: { 'zh-CN': '使用条款', 'zh-TW': '使用條款', en: 'Terms of Use' } },
] as const;

interface LegalMessages {
  sections: { title: string; body: string }[];
  contactSection: { title: string; intro: string; email: string; phone: string; address: string };
}

/** 与 C 端回退渲染结构对齐：章节标题作 H2、联系方式列表；hero 与更新日期由页面渲染，不入正文。 */
function buildMarkdown(msg: LegalMessages): string {
  const parts = msg.sections.map((s) => `## ${s.title}\n\n${s.body}`);
  const c = msg.contactSection;
  parts.push(`## ${c.title}\n\n${c.intro}\n\n- ${c.email}\n- ${c.phone}\n- ${c.address}`);
  return parts.join('\n\n');
}

async function main() {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const page of LEGAL_PAGES) {
    for (const locale of LOCALES) {
      const slug = `${page.key}-${locale.id}`;
      const file = join(MESSAGES_DIR, locale.id, 'pages', `${page.key}.json`);
      const msg = JSON.parse(readFileSync(file, 'utf8')) as LegalMessages;
      const content = buildMarkdown(msg);
      const title = `${page.labels[locale.id]}（${locale.label}）`;

      const existing = await prisma.page.findUnique({ where: { slug } });
      if (existing) {
        if (existing.content?.trim() && !FORCE) {
          skipped += 1;
          console.log(`跳过（已有正文）: ${slug}`);
          continue;
        }
        await prisma.page.update({ where: { slug }, data: { title, content } });
        updated += 1;
        console.log(`更新: ${slug}`);
      } else {
        await prisma.page.create({ data: { title, slug, content, status: 'published' } });
        created += 1;
        console.log(`创建: ${slug}`);
      }
    }
  }

  console.log(`完成：创建 ${created} 条，更新 ${updated} 条，跳过 ${skipped} 条`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
