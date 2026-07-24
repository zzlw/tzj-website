/**
 * 一次性清理脚本：从自定义角色（AccessRole.permissions）中剔除已废弃的权限项。
 *
 * 背景：media.view（媒体库查看）已改为对所有已登录角色默认开放、不再作为独立权限
 * （见 src/access/permissions.ts）。历史遗留的自定义角色数组里可能仍残留该项，
 * 属脏数据——不影响鉴权（权限校验只认现有目录），但会在权限管理界面显示无效项。
 *
 * 用法：
 *   npx tsx scripts/prune-deprecated-permissions.ts             # 执行清理
 *   npx tsx scripts/prune-deprecated-permissions.ts --dry-run   # 仅预览，不写库
 *   （加载 .env：node --env-file=../../.env ./node_modules/tsx/dist/cli.mjs scripts/prune-deprecated-permissions.ts）
 *
 * 行为：
 *   1. 查找 permissions 中含任一废弃项的所有角色
 *   2. 过滤掉废弃项后写回（其余权限原样保留、去重顺序不变）
 *   3. 幂等：重复执行无副作用
 */
import { PrismaClient } from '@prisma/client';

// 已废弃、需从角色权限数组中移除的权限 id（后续如有新增废弃项，追加到此处即可）
const DEPRECATED_PERMISSIONS = ['media.view'] as const;

async function main() {
  const prisma = new PrismaClient();
  const dryRun = process.argv.slice(2).includes('--dry-run');

  console.log('=== 废弃权限清理脚本 ===');
  console.log(`模式: ${dryRun ? '预览（不执行）' : '执行'}`);
  console.log(`待清理权限: ${DEPRECATED_PERMISSIONS.join(', ')}\n`);

  // permissions 为 Postgres text[]，用 hasSome 命中任一废弃项的角色
  const affectedRoles = await prisma.accessRole.findMany({
    where: { permissions: { hasSome: [...DEPRECATED_PERMISSIONS] } },
    select: { id: true, slug: true, name: true, permissions: true },
  });

  if (affectedRoles.length === 0) {
    console.log('没有残留废弃权限的角色，无需清理。');
    await prisma.$disconnect();
    return;
  }

  console.log(`找到 ${affectedRoles.length} 个含废弃权限的角色:`);
  const deprecatedSet = new Set<string>(DEPRECATED_PERMISSIONS);
  const plans = affectedRoles.map((role) => {
    const removed = role.permissions.filter((p) => deprecatedSet.has(p));
    const cleaned = role.permissions.filter((p) => !deprecatedSet.has(p));
    return { role, removed, cleaned };
  });

  for (const { role, removed, cleaned } of plans) {
    console.log(
      `  - ${role.name} (${role.slug}): 移除 [${removed.join(', ')}]，剩余 ${cleaned.length} 项`,
    );
  }

  if (dryRun) {
    console.log('\n[预览模式] 不执行任何变更。');
    await prisma.$disconnect();
    return;
  }

  let updated = 0;
  for (const { role, cleaned } of plans) {
    await prisma.accessRole.update({
      where: { id: role.id },
      data: { permissions: cleaned },
    });
    updated += 1;
  }

  console.log(`\n已清理 ${updated} 个角色的废弃权限。`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('清理失败:', e);
  process.exit(1);
});
