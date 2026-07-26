-- 2FA（TOTP）：User 新增字段 + 恢复码表 + Session 2FA gating 标记
-- 全部可空/带默认值，向后兼容，无破坏性变更

-- AlterTable: users
ALTER TABLE "users" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "twoFactorSecretEnc" TEXT;
ALTER TABLE "users" ADD COLUMN "twoFactorPendingSecretEnc" TEXT;
ALTER TABLE "users" ADD COLUMN "twoFactorPendingCreatedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "twoFactorConfirmedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "twoFactorLastStep" BIGINT;

-- AlterTable: sessions
ALTER TABLE "sessions" ADD COLUMN "twoFactorVerifiedAt" TIMESTAMP(3);

-- CreateTable: two_factor_recovery_codes
CREATE TABLE "two_factor_recovery_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeSalt" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "two_factor_recovery_codes_userId_idx" ON "two_factor_recovery_codes"("userId");

-- AddForeignKey
ALTER TABLE "two_factor_recovery_codes" ADD CONSTRAINT "two_factor_recovery_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
