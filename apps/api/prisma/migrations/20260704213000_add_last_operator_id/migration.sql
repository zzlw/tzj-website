-- 最后操作人关联用户 ID，便于列表展示昵称与 hover 详情

ALTER TABLE "cases" ADD COLUMN "lastOperatorId" TEXT;
ALTER TABLE "news" ADD COLUMN "lastOperatorId" TEXT;
ALTER TABLE "blogs" ADD COLUMN "lastOperatorId" TEXT;
ALTER TABLE "trade_shows" ADD COLUMN "lastOperatorId" TEXT;

-- 按 lastOperator 快照回填（与 formatAuthorLabel 一致）
UPDATE "cases" c
SET "lastOperatorId" = u.id
FROM "users" u
WHERE c."lastOperatorId" IS NULL
  AND c."lastOperator" IS NOT NULL
  AND c."lastOperator" = (
    CASE
      WHEN u.phone IS NOT NULL AND TRIM(u.phone) <> '' THEN
        TRIM(COALESCE(NULLIF(TRIM(u.nickname), ''), u.username)) || ' ' || TRIM(u.phone)
      ELSE TRIM(COALESCE(NULLIF(TRIM(u.nickname), ''), u.username))
    END
  );

UPDATE "news" n
SET "lastOperatorId" = u.id
FROM "users" u
WHERE n."lastOperatorId" IS NULL
  AND n."lastOperator" IS NOT NULL
  AND n."lastOperator" = (
    CASE
      WHEN u.phone IS NOT NULL AND TRIM(u.phone) <> '' THEN
        TRIM(COALESCE(NULLIF(TRIM(u.nickname), ''), u.username)) || ' ' || TRIM(u.phone)
      ELSE TRIM(COALESCE(NULLIF(TRIM(u.nickname), ''), u.username))
    END
  );

UPDATE "blogs" b
SET "lastOperatorId" = u.id
FROM "users" u
WHERE b."lastOperatorId" IS NULL
  AND b."lastOperator" IS NOT NULL
  AND b."lastOperator" = (
    CASE
      WHEN u.phone IS NOT NULL AND TRIM(u.phone) <> '' THEN
        TRIM(COALESCE(NULLIF(TRIM(u.nickname), ''), u.username)) || ' ' || TRIM(u.phone)
      ELSE TRIM(COALESCE(NULLIF(TRIM(u.nickname), ''), u.username))
    END
  );

UPDATE "trade_shows" t
SET "lastOperatorId" = u.id
FROM "users" u
WHERE t."lastOperatorId" IS NULL
  AND t."lastOperator" IS NOT NULL
  AND t."lastOperator" = (
    CASE
      WHEN u.phone IS NOT NULL AND TRIM(u.phone) <> '' THEN
        TRIM(COALESCE(NULLIF(TRIM(u.nickname), ''), u.username)) || ' ' || TRIM(u.phone)
      ELSE TRIM(COALESCE(NULLIF(TRIM(u.nickname), ''), u.username))
    END
  );

ALTER TABLE "cases"
  ADD CONSTRAINT "cases_lastOperatorId_fkey"
  FOREIGN KEY ("lastOperatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "news"
  ADD CONSTRAINT "news_lastOperatorId_fkey"
  FOREIGN KEY ("lastOperatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "blogs"
  ADD CONSTRAINT "blogs_lastOperatorId_fkey"
  FOREIGN KEY ("lastOperatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "trade_shows"
  ADD CONSTRAINT "trade_shows_lastOperatorId_fkey"
  FOREIGN KEY ("lastOperatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "cases_lastOperatorId_idx" ON "cases"("lastOperatorId");
CREATE INDEX "news_lastOperatorId_idx" ON "news"("lastOperatorId");
CREATE INDEX "blogs_lastOperatorId_idx" ON "blogs"("lastOperatorId");
CREATE INDEX "trade_shows_lastOperatorId_idx" ON "trade_shows"("lastOperatorId");
