CREATE TABLE "trade_shows" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT,
    "location" TEXT,
    "eventDateLabel" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "boothNumber" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'exhibition',
    "coverImage" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "externalUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trade_shows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trade_shows_slug_key" ON "trade_shows"("slug");
CREATE INDEX "trade_shows_eventType_idx" ON "trade_shows"("eventType");
CREATE INDEX "trade_shows_status_idx" ON "trade_shows"("status");
CREATE INDEX "trade_shows_startDate_idx" ON "trade_shows"("startDate");
