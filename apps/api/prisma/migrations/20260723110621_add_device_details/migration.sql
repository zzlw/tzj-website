-- AlterTable
ALTER TABLE "chat_rooms" ADD COLUMN     "browserVersion" TEXT,
ADD COLUMN     "clientApp" TEXT,
ADD COLUMN     "deviceModel" TEXT,
ADD COLUMN     "deviceVendor" TEXT,
ADD COLUMN     "osVersion" TEXT;

-- AlterTable
ALTER TABLE "page_views" ADD COLUMN     "browserVersion" TEXT,
ADD COLUMN     "clientApp" TEXT,
ADD COLUMN     "deviceModel" TEXT,
ADD COLUMN     "deviceVendor" TEXT,
ADD COLUMN     "osVersion" TEXT;
