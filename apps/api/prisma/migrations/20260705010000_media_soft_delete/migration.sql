-- 媒体库软删除：回收站 + 延迟物理清除
ALTER TABLE "media_assets" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "media_assets" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "media_assets_deletedAt_idx" ON "media_assets"("deletedAt");
