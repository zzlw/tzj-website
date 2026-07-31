-- 营销弹窗专用头图：与详情页 coverImage 区分运营（弹窗优先 popupImage，留空回退封面图）。
-- 手写迁移：本地不 apply（本地走 db push），生产由 deploy.sh 的 migrate deploy 自动执行。
ALTER TABLE "trade_shows"
  ADD COLUMN IF NOT EXISTS "popupImage" TEXT;
