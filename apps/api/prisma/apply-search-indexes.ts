import { PrismaClient } from '@prisma/client';

/**
 * 聊天检索索引（阶段一 · 零新增基础设施）。
 *
 * 为 chat_messages.content 建立 pg_trgm + GIN 索引，让 `ILIKE '%关键词%'` 走索引，
 * 使坐席端「按聊天内容搜索会话」在中英文混排下都能快速命中（trigram 对中文子串检索
 * 友好，无需分词插件）。幂等：可重复执行，已存在的扩展/索引不会报错。
 *
 * 运行：pnpm --filter @tzj/api prisma:index:search
 *
 * 说明：
 * - CREATE EXTENSION 需要数据库角色具备相应权限；托管数据库若受限，请由 DBA 预置
 *   `pg_trgm` 扩展后再执行本脚本（索引创建部分不需要超级权限）。
 * - 未使用 CONCURRENTLY：当前数据规模下普通建索引足够快；如需在大表上线上零锁建索引，
 *   可改为 CREATE INDEX CONCURRENTLY（须在独立连接、非事务中执行）。
 */
const prisma = new PrismaClient();

async function main() {
  // 1) 启用 trigram 扩展（提供 gin_trgm_ops 与 similarity()）
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
  console.log('✅ pg_trgm 扩展已就绪');

  // 2) chat_messages.content 的 trigram GIN 索引：加速 ILIKE 子串检索
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS chat_messages_content_trgm_idx ON chat_messages USING gin (content gin_trgm_ops);',
  );
  console.log('✅ chat_messages_content_trgm_idx 索引已就绪');
}

main()
  .catch((e) => {
    console.error('❌ 聊天检索索引创建失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
