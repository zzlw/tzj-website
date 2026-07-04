-- 访客分析：IP 地理信息（国家 / 省州 / 城市，采集时解析）

ALTER TABLE "page_views" ADD COLUMN "country" TEXT;
ALTER TABLE "page_views" ADD COLUMN "region" TEXT;
ALTER TABLE "page_views" ADD COLUMN "city" TEXT;

CREATE INDEX "page_views_country_createdAt_idx" ON "page_views"("country", "createdAt");
