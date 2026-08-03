/**
 * 一次性脚本：将 images[] 数组中的图片以 Markdown 语法追加到正文。
 *
 * 背景：旧站迁移数据把 4-5 张图存在 images[] 数组里，但 description/content
 * （Markdown 正文）中未嵌入这些图片。详情页只渲染正文，images[] 在 B 端后台
 * 不可编辑，导致编辑无法管理这些图片。
 *
 * 本脚本把 images[] 中的图片转为 Markdown 图片语法追加到正文末尾，之后编辑
 * 统一通过 B 端 Markdown 编辑器维护。
 *
 * 目标字段：
 *   - Case.description（案例用 description 而非 content）
 *   - News.content
 *   - Blog 跳过（images[] 仅封面，正文已是纯 Markdown）
 *
 * 去重：若图片 URL 已出现在正文中则跳过。
 *
 * 用法：
 *   pnpm --filter @tzj/api tsx prisma/migrate-images-to-content.ts          # dry-run（默认）
 *   pnpm --filter @tzj/api tsx prisma/migrate-images-to-content.ts --apply   # 实际写库
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const isDryRun = !process.argv.includes('--apply');

/** 检查 url 是否已出现在正文中（精确匹配 URL 子串） */
function isUrlAlreadyInContent(url: string, content: string): boolean {
  return content.includes(url);
}

/** 将图片 URL 数组转为 Markdown 图片块 */
function buildMarkdownImageBlock(urls: string[]): string {
  if (urls.length === 0) return '';
  const lines = urls.map((url) => `![图片](${url})`);
  return '\n\n' + lines.join('\n\n');
}

async function migrateCases() {
  const cases = await prisma.case.findMany({
    select: { id: true, title: true, description: true, images: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const c of cases) {
    if (c.images.length === 0) {
      skipped++;
      continue;
    }

    const currentDesc = c.description ?? '';
    const newImages = c.images.filter((url) => !isUrlAlreadyInContent(url, currentDesc));

    if (newImages.length === 0) {
      skipped++;
      continue;
    }

    const appendBlock = buildMarkdownImageBlock(newImages);
    const newDesc = currentDesc + appendBlock;

    console.log(
      `[CASE] ${c.title.slice(0, 40)} | +${newImages.length} imgs (of ${c.images.length}) | desc ${currentDesc.length}→${newDesc.length}`,
    );

    if (!isDryRun) {
      await prisma.case.update({
        where: { id: c.id },
        data: { description: newDesc },
      });
    }
    updated++;
  }

  console.log(`\nCases: ${updated} updated, ${skipped} skipped (no new images)\n`);
}

async function migrateNews() {
  const news = await prisma.news.findMany({
    select: { id: true, title: true, content: true, images: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const n of news) {
    if (n.images.length === 0) {
      skipped++;
      continue;
    }

    const currentContent = n.content ?? '';
    const newImages = n.images.filter((url) => !isUrlAlreadyInContent(url, currentContent));

    if (newImages.length === 0) {
      skipped++;
      continue;
    }

    const appendBlock = buildMarkdownImageBlock(newImages);
    const newContent = currentContent + appendBlock;

    console.log(
      `[NEWS] ${n.title.slice(0, 40)} | +${newImages.length} imgs (of ${n.images.length}) | content ${currentContent.length}→${newContent.length}`,
    );

    if (!isDryRun) {
      await prisma.news.update({
        where: { id: n.id },
        data: { content: newContent },
      });
    }
    updated++;
  }

  console.log(`\nNews: ${updated} updated, ${skipped} skipped (no new images)\n`);
}

async function main() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  images[] → Markdown 正文迁移  (${isDryRun ? 'DRY RUN' : 'APPLY'})`);
  console.log(`${'═'.repeat(60)}\n`);

  await migrateCases();
  await migrateNews();

  console.log(`${'═'.repeat(60)}`);
  if (isDryRun) {
    console.log('  Dry run 完成。加 --apply 参数实际写库。');
  } else {
    console.log('  ✅ 迁移完成！');
  }
  console.log(`${'═'.repeat(60)}\n`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
