/**
 * 一次性迁移脚本：处理使用废弃角色（editor/viewer）的用户账号。
 *
 * 用法：
 *   npx ts-node scripts/migrate-deprecated-roles.ts
 *   npx ts-node scripts/migrate-deprecated-roles.ts --target-role=<slug>  # 将用户迁移到指定角色
 *   npx ts-node scripts/migrate-deprecated-roles.ts --dry-run             # 仅预览，不执行
 *
 * 行为：
 *   1. 查找所有 role 为 editor/viewer 的用户
 *   2. 如果指定 --target-role，将其角色更新为该 slug（需已存在于 AccessRole 表）
 *   3. 如果未指定，将其 isActive 设为 false（停用），等待管理员手动处理
 *   4. 清理废弃的 AccessRole 记录
 */
import { PrismaClient } from '@prisma/client';

const DEPRECATED_ROLES = ['editor', 'viewer'] as const;

async function main() {
  const prisma = new PrismaClient();
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const targetRoleArg = args.find((a) => a.startsWith('--target-role='));
  const targetRole = targetRoleArg?.split('=')[1];

  console.log('=== 废弃角色迁移脚本 ===');
  console.log(`模式: ${dryRun ? '预览（不执行）' : '执行'}`);
  if (targetRole) {
    console.log(`目标角色: ${targetRole}`);
  }

  // 检查目标角色是否存在
  if (targetRole) {
    const role = await prisma.accessRole.findUnique({ where: { slug: targetRole } });
    if (!role) {
      console.error(`错误: 角色 "${targetRole}" 不存在于 AccessRole 表中`);
      process.exit(1);
    }
  }

  // 查找受影响的用户
  const affectedUsers = await prisma.user.findMany({
    where: { role: { in: [...DEPRECATED_ROLES] } },
    select: { id: true, username: true, role: true, isActive: true },
  });

  if (affectedUsers.length === 0) {
    console.log('没有使用废弃角色的用户，无需迁移。');
    await prisma.$disconnect();
    return;
  }

  console.log(`\n找到 ${affectedUsers.length} 个使用废弃角色的用户:`);
  for (const u of affectedUsers) {
    console.log(`  - ${u.username} (role=${u.role}, active=${u.isActive})`);
  }

  if (dryRun) {
    console.log('\n[预览模式] 不执行任何变更。');
    await prisma.$disconnect();
    return;
  }

  // 执行迁移
  if (targetRole) {
    const result = await prisma.user.updateMany({
      where: { role: { in: [...DEPRECATED_ROLES] } },
      data: { role: targetRole },
    });
    console.log(`\n已将 ${result.count} 个用户的角色更新为 "${targetRole}"`);
  } else {
    const result = await prisma.user.updateMany({
      where: { role: { in: [...DEPRECATED_ROLES] }, isActive: true },
      data: { isActive: false },
    });
    console.log(`\n已停用 ${result.count} 个活跃用户。请管理员手动分配新角色后重新启用。`);
  }

  // 清理废弃角色记录
  const deletedRoles = await prisma.accessRole.deleteMany({
    where: { slug: { in: [...DEPRECATED_ROLES] } },
  });
  if (deletedRoles.count > 0) {
    console.log(`已清理 ${deletedRoles.count} 个废弃角色记录。`);
  }

  console.log('\n迁移完成。');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('迁移失败:', e);
  process.exit(1);
});
