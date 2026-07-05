-- AlterTable
ALTER TABLE "integrations" ADD COLUMN "updated_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
