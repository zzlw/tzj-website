-- 营销弹窗专用文案：与详情页 content 区分运营（弹窗优先 popupContent，留空回退详情正文）。
-- 手写迁移：本地不 apply（本地走 db push），生产由 deploy.sh 的 migrate deploy 自动执行。
ALTER TABLE "trade_shows"
  ADD COLUMN IF NOT EXISTS "popupContent" TEXT;
