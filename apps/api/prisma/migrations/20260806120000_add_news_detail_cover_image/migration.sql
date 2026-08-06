-- 新闻详情页宽幅封面（比例特殊，与列表封面分离）；未设置时 C 端回退 coverImage
-- 手写迁移：本地不 apply（本地走 db push），生产由 deploy.sh 的 migrate deploy 自动执行。
ALTER TABLE "news"
  ADD COLUMN IF NOT EXISTS "detailCoverImage" TEXT;
