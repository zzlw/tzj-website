-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "visitorId" TEXT;

-- CreateIndex
CREATE INDEX "contacts_visitorId_idx" ON "contacts"("visitorId");
