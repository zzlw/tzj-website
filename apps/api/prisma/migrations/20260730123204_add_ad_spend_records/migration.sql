-- CreateTable
CREATE TABLE "ad_spend_records" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "spend" DECIMAL(12,2) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_spend_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ad_spend_records_platform_periodStart_idx" ON "ad_spend_records"("platform", "periodStart");

-- CreateIndex
CREATE INDEX "ad_spend_records_periodStart_periodEnd_idx" ON "ad_spend_records"("periodStart", "periodEnd");
