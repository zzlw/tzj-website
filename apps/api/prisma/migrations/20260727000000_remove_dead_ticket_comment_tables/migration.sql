-- 删除死代码工单系统的表（Ticket/Comment 模型全仓零读写，见 docs/DEAD_CODE_REPORT.md §2.1）
-- comments 先删（外键依赖 tickets），CASCADE 兜底

-- DropTable
DROP TABLE IF EXISTS "comments" CASCADE;

-- DropTable
DROP TABLE IF EXISTS "tickets" CASCADE;
