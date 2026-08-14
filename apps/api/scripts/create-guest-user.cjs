/**
 * 游客账号创建脚本（演示/访客场景）。
 *
 * 账号：guest / guest1234
 *   - 参考业内开源项目游客账号惯例：guest 系列用户名（如各演示站/论坛的 guest 访客账号），
 *     密码 guest1234 满足本项目密码策略（≥8 位、大小写字母与数字至少两类、
 *     不在常见弱密码黑名单中——黑名单含 'guest' 但无 'guest1234'）。
 * 角色：guest（自定义只读角色，仅 content.view）
 *   - 不复用已废弃的 viewer：RolesService.syncSystemRoles 在 API 每次启动时
 *     会停用 viewer/editor 账号并删除对应角色行，直接写入会被意外禁用。
 *   - 最小权限原则：游客仅可查看官网内容，无任何写权限。
 *
 * 幂等：角色与账号已存在时同步更新（密码重置为 guest1234、清除登录锁定），不产生重复数据。
 *
 * 为什么是 .cjs：服务器 API 容器内不含 tsx，node 可直接执行本文件；
 * 与 scripts/reset-admin-credentials.ts（break-glass CLI）同口径：bcrypt cost 12 + 审计留痕。
 *
 * 用法（服务器 API 容器内执行）：
 *   node scripts/create-guest-user.cjs
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  // 1. upsert 只读游客角色（permissions 与废弃 viewer 基线一致：仅 content.view）
  const role = await prisma.accessRole.upsert({
    where: { slug: 'guest' },
    update: {
      name: '游客',
      description: '演示/访客只读账号：仅可查看官网内容，无任何写权限。',
      permissions: ['content.view'],
      isSystem: false,
    },
    create: {
      slug: 'guest',
      name: '游客',
      description: '演示/访客只读账号：仅可查看官网内容，无任何写权限。',
      permissions: ['content.view'],
      isSystem: false,
    },
  });

  // 2. upsert 游客账号（bcrypt cost 12，与 users.service 口径一致）
  const hashedPassword = await bcrypt.hash('guest1234', 12);
  const existing = await prisma.user.findUnique({ where: { username: 'guest' } });
  const created = !existing;
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          password: hashedPassword,
          nickname: '游客',
          role: 'guest',
          isActive: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      })
    : await prisma.user.create({
        data: {
          username: 'guest',
          password: hashedPassword,
          nickname: '游客',
          role: 'guest',
          isActive: true,
        },
      });

  // 3. 审计留痕（SSH 场景无操作者身份，userId 置空；与 break-glass 脚本口径一致）
  await prisma.auditLog.create({
    data: {
      userId: null,
      action: 'user_guest_created',
      resource: 'users',
      resourceId: user.id,
      detail: { username: 'guest', role: 'guest', created, via: 'cli' },
    },
  });

  console.log('=== 游客账号创建完成 ===');
  console.log('账号:   guest');
  console.log('密码:   guest1234');
  console.log(`角色:   guest（${role.permissions.join(', ')}，仅只读）`);
  console.log(`状态:   ${created ? '新建' : '已存在，已同步更新（密码已重置、锁定已清除）'}`);
  console.log('审计:   已写入 user_guest_created');
}

main()
  .catch((e) => {
    console.error('执行失败:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
