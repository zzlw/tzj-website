import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const adminUsername = process.env.SEED_ADMIN_USERNAME || "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "REDACTED-PASSWORD";
  const adminHash = await bcrypt.hash(adminPassword, 12);

  // upsert：无论账号是否已存在，都同步为最新的密码/角色，方便改密后重新 seed
  const admin = await prisma.user.upsert({
    where: { username: adminUsername },
    update: {
      password: adminHash,
      role: "admin",
      isActive: true,
    },
    create: {
      username: adminUsername,
      password: adminHash,
      nickname: "超级管理员",
      email: adminUsername.includes("@") ? adminUsername : undefined,
      role: "admin",
      isActive: true,
    },
  });

  console.log("✅ 已创建/更新管理员账号:");
  console.log(`   - ${adminUsername} / ${adminPassword}  (${admin.id})`);
}

main()
  .catch((e) => {
    console.error("❌ Seed 失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
