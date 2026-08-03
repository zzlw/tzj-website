/**
 * 一次性脚本：修正 cases 封面图。
 *
 * 背景：迁移时 cases 的 coverImage 使用了统一兜底图（images/202204/abe3f86ad8a.jpg），
 * 本脚本根据从旧站 HTML 提取的 slug→缩略图映射，逐条更新为真实封面。
 *
 * 旧站新闻本身无独立封面（全部共用同一 banner），故不在本次修正范围。
 *
 * 用法：
 *   pnpm --filter @tzj/api tsx prisma/fix-content-covers.ts          # dry-run（默认）
 *   pnpm --filter @tzj/api tsx prisma/fix-content-covers.ts --dry-run # 仅打印 diff
 *   pnpm --filter @tzj/api tsx prisma/fix-content-covers.ts --apply   # 实际写库
 */
import { PrismaClient } from '@prisma/client';

// ─── 映射表：slug → 旧站缩略图相对 key ──────────────────────────────────────
// 数据来源：旧站 caselist-*.html 列表页 <a> 内嵌 <img src>
// 共 46 条，全部互不相同
const CASE_COVER_MAP: Record<string, string> = {
  'caseshow-52-32': 'uploads/images/202011/578e943dc78.jpg',
  'caseshow-52-33': 'uploads/images/202011/b457d77b7c6.jpg',
  'caseshow-52-34': 'uploads/images/202011/20341310855.jpg',
  'caseshow-52-35': 'uploads/images/202011/2e8e90b0cd1.jpg',
  'caseshow-52-36': 'uploads/images/202011/438a7216861.jpg',
  'caseshow-52-37': 'uploads/images/202011/c335e66a03b.jpg',
  'caseshow-52-38': 'uploads/images/202011/dbb4a518fb7.jpg',
  'caseshow-52-62': 'uploads/images/202011/76c3c867575.jpg',
  'caseshow-52-63': 'uploads/images/202103/7ef0d9d5acd.jpg',
  'caseshow-52-64': 'uploads/images/202103/f5e56c6587f.jpg',
  'caseshow-52-65': 'uploads/images/202103/39862771f41.jpg',
  'caseshow-52-71': 'uploads/images/202605/805a9583a98.jpg',
  'caseshow-52-72': 'uploads/images/202605/00d9bef6c5c.jpg',
  'caseshow-52-73': 'uploads/images/202605/75474726031.jpg',
  'caseshow-52-74': 'uploads/images/202605/a518b43db83.jpg',
  'caseshow-52-75': 'uploads/images/202605/03487a1ebd9.jpg',
  'caseshow-53-31': 'uploads/images/202011/b16fe3178e9.jpg',
  'caseshow-53-39': 'uploads/images/202011/9b60c4d667e.jpg',
  'caseshow-53-40': 'uploads/images/202011/d85e834f974.jpg',
  'caseshow-53-41': 'uploads/images/202011/c9dae4e4843.jpg',
  'caseshow-53-43': 'uploads/images/202011/8b1625b9f50.jpg',
  'caseshow-53-44': 'uploads/images/202011/3dc7bc3008f.jpg',
  'caseshow-53-68': 'uploads/images/202112/6ae07c88e14.jpg',
  'caseshow-53-69': 'uploads/images/202112/62b6f143df4.jpg',
  'caseshow-53-70': 'uploads/images/202112/0ff7bde67e6.jpg',
  'caseshow-53-76': 'uploads/images/202605/3ff75aab390.jpg',
  'caseshow-53-77': 'uploads/images/202605/7c9a68e953c.jpg',
  'caseshow-53-78': 'uploads/images/202605/e828d3ae6a3.jpg',
  'caseshow-53-79': 'uploads/images/202605/082222c0042.jpg',
  'caseshow-54-46': 'uploads/images/202011/cc8cbc2033f.jpg',
  'caseshow-54-47': 'uploads/images/202011/980be928f8b.jpg',
  'caseshow-55-48': 'uploads/images/202011/559f1efdec3.jpg',
  'caseshow-55-49': 'uploads/images/202011/cd4b7ed8431.jpg',
  'caseshow-55-50': 'uploads/images/202011/3c6eb81f537.jpg',
  'caseshow-55-51': 'uploads/images/202011/c9c7d99223d.jpg',
  'caseshow-55-52': 'uploads/images/202011/4c1a023381a.jpg',
  'caseshow-55-53': 'uploads/images/202011/0ccd90121ea.jpg',
  'caseshow-55-54': 'uploads/images/202011/c1922359e4e.jpg',
  'caseshow-55-55': 'uploads/images/202011/725144e0f58.jpg',
  'caseshow-56-56': 'uploads/images/202011/e99ab3b7552.jpg',
  'caseshow-56-57': 'uploads/images/202011/60a71b0e6a2.jpg',
  'caseshow-56-58': 'uploads/images/202011/5cb3f80e831.jpg',
  'caseshow-56-59': 'uploads/images/202011/0949ac6c8dc.jpg',
  'caseshow-56-60': 'uploads/images/202011/f5f77e60e20.jpg',
  'caseshow-57-61': 'uploads/images/202011/4af33bc8f78.jpg',
  'caseshow-57-66': 'uploads/images/202112/a1c957d9278.jpg',
};

// 旧站兜底图 key（这些 slug 的封面当前为此图，需要替换）
const DEFAULT_COVER_KEY = 'images/202204/abe3f86ad8a.jpg';

// ─── 工具函数 ──────────────────────────────────────────────────────────────

function toPublicUrl(relativeKey: string): string {
  const domain = (
    process.env.S3_PUBLIC_DOMAIN || 'http://localhost:9000/tzj-uploads-dev'
  ).replace(/\/$/, '');
  // uploads/images/202605/xxx.jpg → images/202605/xxx.jpg
  const key = relativeKey.replace(/^uploads\//, '');
  return `${domain}/${key}`;
}

function extractKey(url: string): string {
  // 从绝对 URL 提取对象 key：剥离域名前缀
  return url.replace(/^https?:\/\/[^/]+\//, '');
}

// ─── 主逻辑 ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const isDryRun = !process.argv.includes('--apply');
  const prisma = new PrismaClient();

  try {
    // 查询所有 caseshow-* 的案例
    const cases = await prisma.case.findMany({
      where: { slug: { in: Object.keys(CASE_COVER_MAP) } },
      select: { id: true, slug: true, coverImage: true },
    });

    console.log(`\n📋 案例封面修正（${isDryRun ? 'DRY-RUN' : 'APPLY'}）`);
    console.log(`   映射表: ${Object.keys(CASE_COVER_MAP).length} 条`);
    console.log(`   数据库匹配: ${cases.length} 条\n`);

    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    const dbSlugs = new Set(cases.map((c) => c.slug));
    for (const slug of Object.keys(CASE_COVER_MAP)) {
      if (!dbSlugs.has(slug)) {
        console.warn(`   ⚠️  数据库未找到 slug: ${slug}`);
        notFound++;
      }
    }

    for (const c of cases) {
      const relativeKey = CASE_COVER_MAP[c.slug];
      if (!relativeKey) continue;
      const newUrl = toPublicUrl(relativeKey);
      const currentKey = extractKey(c.coverImage || '');

      // 已经是目标封面，跳过
      if (currentKey === relativeKey.replace(/^uploads\//, '')) {
        skipped++;
        continue;
      }

      const currentDisplay = c.coverImage || '(空)';
      const newDisplay = newUrl;

      if (isDryRun) {
        console.log(`   📝 ${c.slug}`);
        console.log(`      当前: ${currentDisplay}`);
        console.log(`      目标: ${newDisplay}`);
      } else {
        await prisma.case.update({
          where: { id: c.id },
          data: { coverImage: newUrl },
        });
        console.log(`   ✅ ${c.slug}: ${currentDisplay} → ${newDisplay}`);
      }
      updated++;
    }

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`   更新: ${updated} 条`);
    console.log(`   跳过（已是目标）: ${skipped} 条`);
    if (notFound > 0) console.log(`   未找到: ${notFound} 条`);
    console.log(`   模式: ${isDryRun ? '🔍 DRY-RUN（未写库）' : '✅ APPLY（已写库）'}`);

    if (isDryRun && updated > 0) {
      console.log(`\n   💡 确认无误后加 --apply 参数重新执行以写入数据库`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error('❌ 案例封面修正失败:', e);
  process.exit(1);
});