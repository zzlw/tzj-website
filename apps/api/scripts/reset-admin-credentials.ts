/**
 * break-glass 凭证重置脚本（docs/security/account-recovery-design.md §4.4）：
 * 唯一超管忘记密码 / 密码 + 2FA 双丢（P4）时经 SSH 执行的最后通道。
 * 相比手写 SQL：能生成 bcrypt hash、口径与线上一致、操作留审计痕。
 *
 * 用法：
 *   pnpm --filter @tzj/api exec tsx scripts/reset-admin-credentials.ts --username <用户名>
 *
 * 可选参数：
 *   --clear-2fa            同步清空 2FA 绑定与全部恢复码（字段口径对齐 TwoFactorService.clearTwoFactor）
 *   --password <新密码>     指定新密码；明文会留在 shell history，仅限特殊场景，优先使用随机生成
 */
import { randomInt } from 'node:crypto';
import { parseArgs } from 'node:util';
import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * 生成 16 位随机强密码：三类字符各至少一个（稳过 IsStrongPassword ≥2 类要求），
 * 字符集剔除易混淆字符（无 i/l/o/0/1），randomInt 为 CSPRNG 熵源。
 */
function generatePassword(): string {
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const digits = '23456789';
  const all = lower + upper + digits;
  const chars = [
    lower[randomInt(lower.length)]!,
    upper[randomInt(upper.length)]!,
    digits[randomInt(digits.length)]!,
    ...Array.from({ length: 13 }, () => all[randomInt(all.length)]!),
  ];
  // Fisher-Yates 打乱，消除前三位的类别位置规律
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}

async function main() {
  const { values } = parseArgs({
    options: {
      username: { type: 'string' },
      'clear-2fa': { type: 'boolean', default: false },
      password: { type: 'string' },
    },
  });

  const username = values.username;
  if (!username) {
    console.error('缺少 --username 参数。用法见脚本头部注释。');
    process.exit(1);
  }
  const clear2fa = values['clear-2fa'] === true;

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      console.error(`用户「${username}」不存在。`);
      process.exit(1);
    }
    if (!user.isActive) {
      // 不自动激活：启用与否是管理决策，脚本不越界
      console.warn(`警告：账号「${username}」当前为停用状态，本脚本不会自动激活。`);
    }

    const plainPassword = values.password ?? generatePassword();
    // bcrypt cost 12，与线上改密口径一致（users.service.resetPassword）
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          // G6 同口径：重置即解除登录锁定
          failedLoginAttempts: 0,
          lockedUntil: null,
          ...(clear2fa
            ? {
                // 对齐 TwoFactorService.clearTwoFactor 的 6 字段口径
                twoFactorEnabled: false,
                twoFactorSecretEnc: null,
                twoFactorPendingSecretEnc: null,
                twoFactorPendingCreatedAt: null,
                twoFactorConfirmedAt: null,
                twoFactorLastStep: null,
              }
            : {}),
        },
      }),
      ...(clear2fa
        ? [prisma.twoFactorRecoveryCode.deleteMany({ where: { userId: user.id } })]
        : []),
      // 撤销全部会话：切断刷新链路，旧 access token ≤15 分钟自然过期
      prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      // SSH 场景无操作者身份，userId 置空但必须留痕（AuditLog.userId 为 String? 可空）
      prisma.auditLog.create({
        data: {
          userId: null,
          action: 'break_glass_credential_reset',
          resource: 'users',
          resourceId: user.id,
          detail: { username: user.username, cleared2fa: clear2fa, via: 'cli' },
        },
      }),
    ];
    await prisma.$transaction(ops);

    console.log('=== break-glass 凭证重置完成 ===');
    console.log(`用户:       ${user.username} (${user.id})`);
    console.log(`新密码:     ${plainPassword}`);
    console.log('           （明文仅打印这一次，请立即安全转交并提醒登录后自行改密）');
    console.log(`2FA:        ${clear2fa ? '已清空绑定与恢复码，可重新绑定' : '未变更'}`);
    console.log('登录锁定:   已解除（失败计数清零）');
    console.log('会话:       已全部撤销（旧 access token 最长 15 分钟内自然过期）');
    console.log('审计:       已写入 break_glass_credential_reset');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('执行失败:', e);
  process.exit(1);
});
