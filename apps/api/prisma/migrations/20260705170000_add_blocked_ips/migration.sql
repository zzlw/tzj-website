-- AlterTable
ALTER TABLE "page_views" ADD COLUMN "ipMasked" TEXT;

-- CreateIndex
CREATE INDEX "page_views_ipHash_createdAt_idx" ON "page_views"("ipHash", "createdAt");

-- CreateTable
CREATE TABLE "blocked_ips" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "ipMasked" TEXT NOT NULL,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_ips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blocked_ips_ipHash_key" ON "blocked_ips"("ipHash");

-- CreateIndex
CREATE INDEX "blocked_ips_expiresAt_idx" ON "blocked_ips"("expiresAt");

-- AddForeignKey
ALTER TABLE "blocked_ips" ADD CONSTRAINT "blocked_ips_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
