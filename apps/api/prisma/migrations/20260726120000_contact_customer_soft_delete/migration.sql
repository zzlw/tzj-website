-- 询盘/客户软删除（回收站）：加 deletedAt 列 + 索引
-- 见 docs/design/deletion-strategy.md（v2 定稿）；纯加列，无破坏性变更

-- AlterTable: contacts
ALTER TABLE "contacts" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable: customers
ALTER TABLE "customers" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "contacts_deletedAt_idx" ON "contacts"("deletedAt");
CREATE INDEX "customers_deletedAt_idx" ON "customers"("deletedAt");
