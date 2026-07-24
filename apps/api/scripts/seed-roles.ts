/**
 * 预置业务角色种子脚本：创建 4 个标准业务角色。
 *
 * 用法：
 *   npx tsx scripts/seed-roles.ts
 *   npx tsx scripts/seed-roles.ts --dry-run   # 仅预览
 *
 * 设计原则（业内最佳实践）：
 *   - 最小权限：每个角色仅授予完成其职责所需的最少权限
 *   - 职责分离：运维 / 客服 / 内容 / 管理 四权分立
 *   - 破坏性操作（永久删除、删除内容）仅保留给超级管理员
 *   - 只读优先：跨模块仅授予查看权限，避免越权操作
 */
import { PrismaClient } from '@prisma/client';

interface RoleSeed {
  slug: string;
  name: string;
  description: string;
  permissions: string[];
}

const ROLES: RoleSeed[] = [
  {
    slug: 'ops',
    name: '网站运维人员',
    description:
      '负责网站安全、系统监控与第三方集成管理。可管理 IP 封禁、查看系统健康状态与访客分析，不涉及内容编辑与账号管理。',
    permissions: [
      // 网站安全（核心职责）
      'security.view',
      'security.manage',
      // 系统监控
      'system.view',
      // 运营分析
      'analytics.view',
      // 集成凭证管理
      'integrations.view',
      'integrations.manage',
      // 只读：排查问题时需要查看
      'settings.view',
      'audit.view',
    ],
  },
  {
    slug: 'support',
    name: '网站客服',
    description:
      '负责在线客服与工单处理。可管理实时会话、回复工单、处理询盘与客户跟进，不涉及内容发布与系统配置。',
    permissions: [
      // 在线聊天（核心职责）
      'chat.view',
      'chat.manage',
      // 工单处理（核心职责）
      'tickets.view',
      'tickets.manage',
      // 客户管理（核心职责）
      'customers.view',
      'customers.manage',
      // 询盘处理
      'contacts.view',
      'contacts.manage',
      // 只读：查阅知识库
      'docs.view',
    ],
  },
  {
    slug: 'content-manager',
    name: '网站内容管理',
    description:
      '负责官网内容全生命周期管理。可创建、编辑、发布内容与媒体，查看运营数据以优化内容策略，不涉及账号管理与系统配置。',
    permissions: [
      // 内容管理（核心职责 - 完整生命周期）
      'content.view',
      'content.create',
      'content.edit',
      'content.publish',
      'content.delete',
      // 媒体管理
      'media.upload',
      'media.delete',
      // 运营分析（内容效果评估）
      'analytics.view',
      // 内部文档协作
      'docs.view',
      'docs.create',
      'docs.edit',
      // 只读：了解客户反馈辅助内容策划
      'contacts.view',
    ],
  },
  {
    slug: 'site-admin',
    name: '网站管理员',
    description:
      '日常站点管理，涵盖账号管理、角色分配、站点设置、安全策略与内容审核。不具备永久删除媒体、删除内容等不可逆操作权限（需超级管理员执行）。',
    permissions: [
      // 系统管理（核心职责）
      'users.manage',
      'access.view',
      'access.manage',
      'audit.view',
      'settings.view',
      'settings.manage',
      // 安全与集成
      'security.view',
      'security.manage',
      'integrations.view',
      'integrations.manage',
      'system.view',
      // 运营分析
      'analytics.view',
      // 内容审核与发布（不含创建/删除 — 职责分离）
      'content.view',
      'content.edit',
      'content.publish',
      // 媒体（不含删除/永久清除）
      'media.upload',
      // 客服监控（只读）
      'chat.view',
      'tickets.view',
      // 询盘与客户
      'contacts.view',
      'contacts.manage',
      'customers.view',
      // 内部文档管理
      'docs.view',
      'docs.create',
      'docs.edit',
      'docs.publish',
      'docs.manage',
    ],
  },
];

async function main() {
  const prisma = new PrismaClient();
  const dryRun = process.argv.includes('--dry-run');

  console.log('=== 预置业务角色种子 ===');
  console.log(`模式: ${dryRun ? '预览（不执行）' : '执行'}\n`);

  for (const role of ROLES) {
    const existing = await prisma.accessRole.findUnique({ where: { slug: role.slug } });

    if (existing) {
      console.log(`[跳过] ${role.name} (${role.slug}) — 已存在`);
      if (!dryRun) {
        // 更新权限（保持同步）
        await prisma.accessRole.update({
          where: { slug: role.slug },
          data: {
            name: role.name,
            description: role.description,
            permissions: role.permissions,
          },
        });
        console.log(`       → 权限已同步更新 (${role.permissions.length} 项)`);
      }
      continue;
    }

    console.log(`[创建] ${role.name} (${role.slug})`);
    console.log(`       权限 (${role.permissions.length} 项): ${role.permissions.join(', ')}`);

    if (!dryRun) {
      await prisma.accessRole.create({
        data: {
          slug: role.slug,
          name: role.name,
          description: role.description,
          permissions: role.permissions,
          isSystem: false,
        },
      });
    }
  }

  console.log('\n完成。');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('执行失败:', e);
  process.exit(1);
});
