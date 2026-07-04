-- 官网访客分析：页面浏览事件（first-party）

CREATE TABLE "page_views" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT,
    "referrer" TEXT,
    "referrerHost" TEXT,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "deviceType" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_views_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "page_views_createdAt_idx" ON "page_views"("createdAt");
CREATE INDEX "page_views_path_createdAt_idx" ON "page_views"("path", "createdAt");
CREATE INDEX "page_views_sessionId_idx" ON "page_views"("sessionId");
CREATE INDEX "page_views_referrerHost_createdAt_idx" ON "page_views"("referrerHost", "createdAt");
CREATE INDEX "page_views_isBot_createdAt_idx" ON "page_views"("isBot", "createdAt");
