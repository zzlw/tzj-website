-- 水印烧录状态：true=服务端已烧录；false=服务端经手但确认未烧录；NULL=未知（历史数据/直传登记/替换链路）
ALTER TABLE "media_assets" ADD COLUMN "watermarked" BOOLEAN;
