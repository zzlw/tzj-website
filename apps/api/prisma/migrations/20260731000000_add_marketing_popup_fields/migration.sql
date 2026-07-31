-- 营销弹窗：TradeShow +10 字段（docs/activity-system-design.md §3）
-- 手写迁移：本地不 apply（本地走 db push），生产由 deploy.sh 的 migrate deploy 自动执行。
-- 注意：excludePages 不带 NOT NULL——Prisma 为标量数组列生成的 DDL 即不带（0_init 的 images 先例），
-- 带上会造成生产（migrate deploy）与本地（db push）可空性漂移。
ALTER TABLE "trade_shows"
  ADD COLUMN IF NOT EXISTS "isMarketing"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "triggerMode"     TEXT    NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS "delaySeconds"    INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "frequency"       TEXT    NOT NULL DEFAULT 'session',
  ADD COLUMN IF NOT EXISTS "excludePages"    TEXT[]  DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "targetDevice"    TEXT    NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS "ctaText"         TEXT    NOT NULL DEFAULT '立即参与',
  ADD COLUMN IF NOT EXISTS "ctaUrl"          TEXT,
  ADD COLUMN IF NOT EXISTS "popupViewCount"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "popupClickCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "trade_shows_isMarketing_idx" ON "trade_shows"("isMarketing");
