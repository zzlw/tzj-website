import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { DEFAULT_SITE_PUBLIC_SETTINGS, SITE_PUBLIC_SETTING_KEY } from "../src/settings/settings.defaults";

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

  await prisma.setting.upsert({
    where: { key: SITE_PUBLIC_SETTING_KEY },
    update: {},
    create: {
      key: SITE_PUBLIC_SETTING_KEY,
      group: "site",
      label: "官网公开设置",
      sortOrder: 0,
      value: DEFAULT_SITE_PUBLIC_SETTINGS as object,
    },
  });
  console.log("✅ 已初始化官网站点设置 (site.public)");

  const folderDefaults = [
    { slug: "sales", name: "销售与市场", sortOrder: 0 },
    { slug: "engineering", name: "工程与产品", sortOrder: 1 },
    { slug: "operations", name: "运营与售后", sortOrder: 2 },
    { slug: "administration", name: "管理与制度", sortOrder: 3 },
  ];
  for (const item of folderDefaults) {
    const existing = await prisma.docFolder.findFirst({
      where: { slug: item.slug, parentId: null, ownerId: null },
    });
    if (existing) {
      await prisma.docFolder.update({
        where: { id: existing.id },
        data: { name: item.name, sortOrder: item.sortOrder },
      });
    } else {
      await prisma.docFolder.create({ data: { ...item, parentId: null, ownerId: null } });
    }
  }
  console.log("✅ 已初始化内部文档文件夹");
}

main()
  .catch((e) => {
    console.error("❌ Seed 失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
