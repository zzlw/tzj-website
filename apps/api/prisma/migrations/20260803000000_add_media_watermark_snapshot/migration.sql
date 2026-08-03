-- 素材水印参数快照与配置指纹：烧录时记录所用渲染参数（config + appliedAt）与指纹，
-- 供识别「旧参数素材」并为批量重烧打基础。
-- 手写迁移：本地不 apply（本地走 db push），生产由 deploy.sh 的 migrate deploy 自动执行。
ALTER TABLE "media_assets"
  ADD COLUMN IF NOT EXISTS "watermarkParams" JSONB,
  ADD COLUMN IF NOT EXISTS "watermarkFingerprint" TEXT;
