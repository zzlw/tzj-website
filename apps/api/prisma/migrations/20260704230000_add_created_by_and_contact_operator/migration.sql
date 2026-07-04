-- 内容模块：创建人
ALTER TABLE "cases" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "cases" ADD COLUMN "createdById" TEXT;
ALTER TABLE "news" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "news" ADD COLUMN "createdById" TEXT;
ALTER TABLE "blogs" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "blogs" ADD COLUMN "createdById" TEXT;
ALTER TABLE "trade_shows" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "trade_shows" ADD COLUMN "createdById" TEXT;

-- 询盘：最后操作人
ALTER TABLE "contacts" ADD COLUMN "lastOperator" TEXT;
ALTER TABLE "contacts" ADD COLUMN "lastOperatorId" TEXT;

-- 回填创建人（优先用最后操作人）
UPDATE "cases" SET "createdById" = "lastOperatorId", "createdBy" = "lastOperator"
WHERE "createdById" IS NULL AND "lastOperatorId" IS NOT NULL;
UPDATE "news" SET "createdById" = "lastOperatorId", "createdBy" = "lastOperator"
WHERE "createdById" IS NULL AND "lastOperatorId" IS NOT NULL;
UPDATE "blogs" SET "createdById" = "lastOperatorId", "createdBy" = "lastOperator"
WHERE "createdById" IS NULL AND "lastOperatorId" IS NOT NULL;
UPDATE "trade_shows" SET "createdById" = "lastOperatorId", "createdBy" = "lastOperator"
WHERE "createdById" IS NULL AND "lastOperatorId" IS NOT NULL;

ALTER TABLE "cases"
  ADD CONSTRAINT "cases_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "news"
  ADD CONSTRAINT "news_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "blogs"
  ADD CONSTRAINT "blogs_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "trade_shows"
  ADD CONSTRAINT "trade_shows_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contacts"
  ADD CONSTRAINT "contacts_lastOperatorId_fkey"
  FOREIGN KEY ("lastOperatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "cases_createdById_idx" ON "cases"("createdById");
CREATE INDEX "news_createdById_idx" ON "news"("createdById");
CREATE INDEX "blogs_createdById_idx" ON "blogs"("createdById");
CREATE INDEX "trade_shows_createdById_idx" ON "trade_shows"("createdById");
CREATE INDEX "contacts_lastOperatorId_idx" ON "contacts"("lastOperatorId");
