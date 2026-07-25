-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "visitorId" TEXT;

-- CreateIndex
CREATE INDEX "customers_visitorId_idx" ON "customers"("visitorId");
