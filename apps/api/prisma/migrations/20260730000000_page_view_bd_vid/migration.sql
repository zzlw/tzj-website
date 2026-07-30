-- 营销归因：page_views 增加百度 OCPC 点击 ID（bd_vid），与 gclid 平行，供付费渠道归因与 OCPC 转化回传
ALTER TABLE "page_views" ADD COLUMN "bdVid" TEXT;
