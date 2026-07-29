-- 修复 schema 漂移：schema.prisma 早已定义 InternalDocument.sortOrder（@map("sort_order")）
-- 及 @@index([folderId, sortOrder])，但一直缺少对应 migration——dev 库经 db push 有该列，
-- 生产库经 migrate deploy 建表时缺列，导致文档中心查询（按 sortOrder 排序）在生产运行时报错。
--
-- 幂等写法（ADD COLUMN / CREATE INDEX IF NOT EXISTS）：生产已通过热修先行补列，
-- 本迁移在后续 migrate deploy 中重跑亦为无操作，不会因列/索引已存在而失败。

ALTER TABLE "internal_documents" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "internal_documents_folder_id_sort_order_idx" ON "internal_documents"("folder_id", "sort_order");
