-- 访客分析：记录定位依据（ip / gps）

ALTER TABLE "page_views" ADD COLUMN "geoSource" TEXT;

CREATE INDEX "page_views_geoSource_createdAt_idx" ON "page_views"("geoSource", "createdAt");
