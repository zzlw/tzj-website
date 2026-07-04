-- 内容系统元数据：真实系统发布时间 + 最后操作人（后台内部字段）

ALTER TABLE "cases" ADD COLUMN "systemPublishedAt" TIMESTAMP(3);
ALTER TABLE "cases" ADD COLUMN "lastOperator" TEXT;

ALTER TABLE "news" ADD COLUMN "systemPublishedAt" TIMESTAMP(3);
ALTER TABLE "news" ADD COLUMN "lastOperator" TEXT;

ALTER TABLE "blogs" ADD COLUMN "systemPublishedAt" TIMESTAMP(3);
ALTER TABLE "blogs" ADD COLUMN "lastOperator" TEXT;

ALTER TABLE "trade_shows" ADD COLUMN "systemPublishedAt" TIMESTAMP(3);
ALTER TABLE "trade_shows" ADD COLUMN "lastOperator" TEXT;

-- 已发布内容回填系统时间（优先用户发布时间，否则更新时间）
UPDATE "cases"
SET "systemPublishedAt" = COALESCE("completionDate", "updatedAt")
WHERE "status" = 'published' AND "systemPublishedAt" IS NULL;

UPDATE "news"
SET "systemPublishedAt" = COALESCE("publishedAt", "updatedAt")
WHERE "status" = 'published' AND "systemPublishedAt" IS NULL;

UPDATE "blogs"
SET "systemPublishedAt" = COALESCE("publishedAt", "updatedAt")
WHERE "status" = 'published' AND "systemPublishedAt" IS NULL;

UPDATE "trade_shows"
SET "systemPublishedAt" = COALESCE("publishedAt", "updatedAt")
WHERE "status" = 'published' AND "systemPublishedAt" IS NULL;

-- 回填最后操作人（沿用现有 author）
UPDATE "cases" SET "lastOperator" = "author" WHERE "lastOperator" IS NULL AND "author" IS NOT NULL;
UPDATE "news" SET "lastOperator" = "author" WHERE "lastOperator" IS NULL AND "author" IS NOT NULL;
UPDATE "blogs" SET "lastOperator" = "author" WHERE "lastOperator" IS NULL AND "author" IS NOT NULL;
UPDATE "trade_shows" SET "lastOperator" = "author" WHERE "lastOperator" IS NULL AND "author" IS NOT NULL;

CREATE INDEX "cases_systemPublishedAt_idx" ON "cases"("systemPublishedAt");
CREATE INDEX "news_systemPublishedAt_idx" ON "news"("systemPublishedAt");
CREATE INDEX "blogs_systemPublishedAt_idx" ON "blogs"("systemPublishedAt");
CREATE INDEX "trade_shows_systemPublishedAt_idx" ON "trade_shows"("systemPublishedAt");
