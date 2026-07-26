import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { OnModuleInit } from '@nestjs/common';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type {
  TwoFactorEnableResult,
  TwoFactorSetupResult,
  TwoFactorStatusResult,
  TwoFactorVerifyResult,
} from '@tzj/types';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';
import { CRYPTO_CONTEXT_2FA, decryptString, encryptString } from '../common/crypto/secrets-crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestMeta } from './auth.service';
import { AuthService } from './auth.service';
import type { JwtPayload } from './roles';

/** 审计动作名集中定义，防拼写漂移（告警已裁，AuditLog 是唯一检测面） */
const AUDIT = {
  SETUP: '2fa_setup',
  ENABLED: '2fa_enabled',
  DISABLED: '2fa_disabled',
  VERIFIED: '2fa_verified',
  FAILED: '2fa_failed',
  RECOVERY_USED: '2fa_recovery_used',
  RECOVERY_REGENERATED: '2fa_recovery_regenerated',
  KILLSWITCH_ACTIVATED: '2fa_killswitch_activated',
  FORCE_DISABLED: '2fa_force_disabled',
} as const;

const TOTP_ISSUER = 'TZJ Admin';
const RECOVERY_CODE_COUNT = 10;
/** per-账号（sub 维度）verify 尝试上限：重签 pendingToken 无法刷新配额（复核修正 A3） */
const MAX_VERIFY_ATTEMPTS = 5;
const ATTEMPT_TTL_MS = 5 * 60_000;

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** RFC 4648 base32（无填充）：10 字节 → 恰好 16 字符（80 位熵） */
function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** 恢复码规范化：去连字符/空白、转大写 */
function normalizeRecoveryCode(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase();
}

@Injectable()
export class TwoFactorService implements OnModuleInit {
  private readonly logger = new Logger('TwoFactor');

  /** pendingToken jti 单用黑名单（jti → 过期时间戳 ms；单实例内存结构，见方案 §6.4 单实例声明） */
  private readonly usedJtis = new Map<string, number>();
  /** per-账号 verify 尝试计数（sub → 计数与过期时间） */
  private readonly attempts = new Map<string, { count: number; expireAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
  ) {}

  async onModuleInit() {
    // kill-switch 置位必须显眼：启动日志 ERROR 横幅 + 审计（事故止血用，恢复后须立即关闭）
    if (this.auth.twoFactorChallengeDisabled()) {
      this.logger.error(
        '████ TWOFA_CHALLENGE_DISABLED=true：2FA 登录挑战与 refresh gating 已全局豁免（kill-switch）。' +
          '仅限事故止血，恢复后立即移除该环境变量！████',
      );
      await this.audit(null, AUDIT.KILLSWITCH_ACTIVATED, 'auth', null, {});
    }
  }

  // ── 状态 ─────────────────────────────────────────
  async status(userId: string): Promise<TwoFactorStatusResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const recoveryCodesRemaining = user.twoFactorEnabled
      ? await this.prisma.twoFactorRecoveryCode.count({ where: { userId, usedAt: null } })
      : 0;
    return {
      enabled: user.twoFactorEnabled,
      confirmedAt: user.twoFactorConfirmedAt?.toISOString() ?? null,
      recoveryCodesRemaining,
    };
  }

  // ── 绑定：Setup → Enable ─────────────────────────
  async setup(userId: string, password: string, meta: RequestMeta): Promise<TwoFactorSetupResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (user.twoFactorEnabled) {
      throw new BadRequestException('两步验证已启用，如需重新绑定请先关闭');
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException('密码不正确');

    const secret = authenticator.generateSecret(32); // 32 字节熵 → 256 位，base32 编码
    const otpauthUri = authenticator.keyuri(user.username, TOTP_ISSUER, secret);
    const qrDataUrl = await toDataURL(otpauthUri);
    const ttlMin = this.config.get<number>('TWOFA_SETUP_TTL_MINUTES') ?? 15;
    const expiresAt = new Date(Date.now() + ttlMin * 60_000);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorPendingSecretEnc: this.encrypt(secret),
        twoFactorPendingCreatedAt: new Date(),
      },
    });
    await this.audit(userId, AUDIT.SETUP, 'auth', userId, meta);
    // Secret 明文不落服务端日志，仅在响应中一次性返回
    return { otpauthUri, qrDataUrl, secret, expiresAt: expiresAt.toISOString() };
  }

  async enable(
    userId: string,
    code: string,
    meta: RequestMeta,
    refreshToken?: string,
  ): Promise<TwoFactorEnableResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (user.twoFactorEnabled) {
      throw new BadRequestException('两步验证已启用');
    }
    const ttlMin = this.config.get<number>('TWOFA_SETUP_TTL_MINUTES') ?? 15;
    const pendingFresh =
      user.twoFactorPendingSecretEnc &&
      user.twoFactorPendingCreatedAt &&
      Date.now() - user.twoFactorPendingCreatedAt.getTime() < ttlMin * 60_000;
    if (!pendingFresh || !user.twoFactorPendingSecretEnc) {
      throw new BadRequestException('绑定已过期，请重新生成二维码');
    }

    const secret = this.decrypt(user.twoFactorPendingSecretEnc);
    const delta = this.checkTotp(code, secret);
    if (delta === null) {
      await this.audit(userId, AUDIT.FAILED, 'auth', userId, meta);
      throw new BadRequestException('验证码错误，请重试');
    }

    const { plain, rows } = this.generateRecoveryCodes();
    const currentTokenHash = refreshToken ? this.hashToken(refreshToken) : null;
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: true,
          twoFactorSecretEnc: user.twoFactorPendingSecretEnc,
          twoFactorPendingSecretEnc: null,
          twoFactorPendingCreatedAt: null,
          twoFactorConfirmedAt: now,
          // 置 null：首登走 NULL 分支放行，避免「启用步」误杀启用后 30s 内的首次登录
          twoFactorLastStep: null,
        },
      }),
      this.prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
      this.prisma.twoFactorRecoveryCode.createMany({
        data: rows.map((r) => ({ userId, codeHash: r.codeHash, codeSalt: r.codeSalt })),
      }),
      // 启用 2FA 是敏感变更：撤销该用户其他所有会话，强制其它设备重新登录
      this.prisma.session.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}),
        },
        data: { revokedAt: now },
      }),
      // 当前会话标记已通过 2FA，避免启用者在下次 refresh 被 gating 误踢
      ...(currentTokenHash
        ? [
            this.prisma.session.updateMany({
              where: { userId, tokenHash: currentTokenHash, revokedAt: null },
              data: { twoFactorVerifiedAt: now },
            }),
          ]
        : []),
    ]);

    await this.audit(userId, AUDIT.ENABLED, 'auth', userId, meta);
    return { recoveryCodes: plain };
  }

  // ── 登录第二步 ───────────────────────────────────
  async verify(
    pendingToken: string,
    code: string | undefined,
    recoveryCode: string | undefined,
    meta: RequestMeta,
  ): Promise<TwoFactorVerifyResult> {
    this.sweepExpired();
    if (!code && !recoveryCode) {
      throw new BadRequestException('请提供验证码或恢复码');
    }

    let payload: JwtPayload & { exp?: number };
    try {
      payload = await this.jwt.verifyAsync<JwtPayload & { exp?: number }>(pendingToken, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('验证已超时，请重新登录');
    }
    if (payload.type !== 'twofa_pending' || !payload.jti) {
      throw new UnauthorizedException('令牌类型错误');
    }
    // jti 单用：成功 verify 过的 pendingToken 不得重放
    if (this.usedJtis.has(payload.jti)) {
      await this.audit(payload.sub, AUDIT.FAILED, 'auth', payload.sub, meta);
      throw new UnauthorizedException('该登录请求已完成，请重新登录');
    }
    // per-账号尝试上限：达上限即作废该 pendingToken（重走密码关也无法刷新配额）
    const attempt = this.attempts.get(payload.sub);
    if (attempt && attempt.count >= MAX_VERIFY_ATTEMPTS) {
      await this.audit(payload.sub, AUDIT.FAILED, 'auth', payload.sub, meta);
      throw new UnauthorizedException('尝试次数过多，请稍后重新登录');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('账号不存在或已停用');
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new ForbiddenException('账号已临时锁定，请稍后重试');
    }
    if (!user.twoFactorEnabled || !user.twoFactorSecretEnc) {
      // 挑战签发后 2FA 被关闭（如运维救急）→ 令牌语义失效，重走密码登录即可直接放行
      throw new UnauthorizedException('两步验证状态已变更，请重新登录');
    }

    let warning: string | undefined;
    if (code) {
      const secret = this.decrypt(user.twoFactorSecretEnc);
      const delta = this.checkTotp(code, secret);
      if (delta === null) {
        await this.recordFailure(payload.sub, meta);
        throw new UnauthorizedException('验证码错误');
      }
      // 绝对时间步原子写入（复核修正 A1：affected rows 是唯一裁决，防 TOCTOU 并发重放）
      const consumed = await this.consumeTotpStep(user.id, user.twoFactorLastStep, delta);
      if (!consumed) {
        await this.recordFailure(payload.sub, meta);
        throw new UnauthorizedException('该验证码已使用，请等待约 30 秒后重试');
      }
    } else if (recoveryCode) {
      const hit = await this.consumeRecoveryCode(user.id, recoveryCode);
      if (!hit) {
        await this.recordFailure(payload.sub, meta);
        throw new UnauthorizedException('恢复码无效');
      }
      await this.audit(user.id, AUDIT.RECOVERY_USED, 'auth', user.id, meta);
      const remaining = await this.prisma.twoFactorRecoveryCode.count({
        where: { userId: user.id, usedAt: null },
      });
      if (remaining <= 2) {
        warning = `恢复码仅剩 ${remaining} 个，请尽快在设置中重新生成`;
      }
    }

    // 成功：jti 进单用黑名单（存活至令牌自然过期），清空尝试计数
    const jtiTtl = payload.exp ? payload.exp * 1000 : Date.now() + ATTEMPT_TTL_MS;
    this.usedJtis.set(payload.jti, jtiTtl);
    this.attempts.delete(payload.sub);

    const result = await this.auth.issueVerifiedSession(user.id, meta);
    await this.audit(user.id, AUDIT.VERIFIED, 'auth', user.id, meta);
    return { ...result, ...(warning ? { warning } : {}) };
  }

  // ── 解绑 ─────────────────────────────────────────
  async disable(
    userId: string,
    password: string,
    code: string | undefined,
    recoveryCode: string | undefined,
    meta: RequestMeta,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (!user.twoFactorEnabled || !user.twoFactorSecretEnc) {
      throw new BadRequestException('两步验证未启用');
    }
    // 双重确认：密码 + 动态码/恢复码
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException('密码不正确');
    await this.requireValidSecondFactor(user, code, recoveryCode, meta);

    await this.clearTwoFactor(userId);
    await this.audit(userId, AUDIT.DISABLED, 'auth', userId, meta);
    return { success: true };
  }

  /** 运维救急（break-glass）：admin 强制关闭指定用户 2FA（操作即审计，无双人复核） */
  async forceDisable(actorId: string, targetUserId: string, password: string, meta: RequestMeta) {
    const actor = await this.prisma.user.findUnique({ where: { id: actorId } });
    if (!actor) throw new UnauthorizedException();
    const ok = await bcrypt.compare(password, actor.password);
    if (!ok) throw new UnauthorizedException('密码不正确');

    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('目标用户不存在');
    if (!target.twoFactorEnabled) {
      throw new BadRequestException('目标用户未启用两步验证');
    }

    await this.clearTwoFactor(targetUserId);
    await this.audit(actorId, AUDIT.FORCE_DISABLED, 'auth', targetUserId, meta);
    this.logger.warn(`高危操作：${actor.username} 强制关闭了用户 ${target.username} 的两步验证`);
    return { success: true };
  }

  // ── 恢复码重新生成 ───────────────────────────────
  async regenerateRecoveryCodes(
    userId: string,
    code: string,
    meta: RequestMeta,
  ): Promise<TwoFactorEnableResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (!user.twoFactorEnabled || !user.twoFactorSecretEnc) {
      throw new BadRequestException('两步验证未启用');
    }
    await this.requireValidSecondFactor(user, code, undefined, meta);

    const { plain, rows } = this.generateRecoveryCodes();
    await this.prisma.$transaction([
      this.prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
      this.prisma.twoFactorRecoveryCode.createMany({
        data: rows.map((r) => ({ userId, codeHash: r.codeHash, codeSalt: r.codeSalt })),
      }),
    ]);
    await this.audit(userId, AUDIT.RECOVERY_REGENERATED, 'auth', userId, meta);
    return { recoveryCodes: plain };
  }

  // ── 内部工具 ─────────────────────────────────────

  /** 校验动态码（原子消费时间步）或恢复码（原子消费一次一密），失败统一审计 + 抛错 */
  private async requireValidSecondFactor(
    user: { id: string; twoFactorSecretEnc: string | null; twoFactorLastStep: bigint | null },
    code: string | undefined,
    recoveryCode: string | undefined,
    meta: RequestMeta,
  ) {
    if (code && user.twoFactorSecretEnc) {
      const delta = this.checkTotp(code, this.decrypt(user.twoFactorSecretEnc));
      if (delta !== null && (await this.consumeTotpStep(user.id, user.twoFactorLastStep, delta))) {
        return;
      }
    } else if (recoveryCode) {
      if (await this.consumeRecoveryCode(user.id, recoveryCode)) {
        await this.audit(user.id, AUDIT.RECOVERY_USED, 'auth', user.id, meta);
        return;
      }
    }
    await this.audit(user.id, AUDIT.FAILED, 'auth', user.id, meta);
    throw new UnauthorizedException('验证码或恢复码无效');
  }

  /** TOTP 校验：window:1（±1 时间步容差），返回偏移量 delta（null = 无效） */
  private checkTotp(code: string, secret: string): number | null {
    authenticator.options = { window: 1 };
    try {
      return authenticator.checkDelta(code, secret);
    } catch {
      return null;
    }
  }

  /**
   * 绝对时间步原子消费（防重放）：floor(epoch/30s) + delta 单调递增。
   * updateMany 条件写（NULL 或 lt matchedStep），affected rows 为唯一裁决——
   * 并发 verify 同读旧 step 时只有一个能赢（复核修正 A1）。
   */
  private async consumeTotpStep(
    userId: string,
    lastStep: bigint | null,
    delta: number,
  ): Promise<boolean> {
    const matchedStep = BigInt(Math.floor(Date.now() / 30_000) + delta);
    // 快速路径预检（省一次写），最终裁决在下方原子写
    if (lastStep !== null && matchedStep <= lastStep) return false;
    const { count } = await this.prisma.user.updateMany({
      where: {
        id: userId,
        OR: [{ twoFactorLastStep: null }, { twoFactorLastStep: { lt: matchedStep } }],
      },
      data: { twoFactorLastStep: matchedStep },
    });
    return count === 1;
  }

  /**
   * 恢复码原子消费（一次一密）：每码独立 salt 无法按 hash 反查，须逐条带 salt 重算；
   * timingSafeEqual 常量时间比对防时序侧信道；updateMany WHERE usedAt IS NULL 防并发双花（复核修正 A2）。
   */
  private async consumeRecoveryCode(userId: string, candidate: string): Promise<boolean> {
    const normalized = normalizeRecoveryCode(candidate);
    if (!normalized) return false;
    const records = await this.prisma.twoFactorRecoveryCode.findMany({
      where: { userId, usedAt: null },
    });
    for (const record of records) {
      const digest = createHash('sha256')
        .update(record.codeSalt + normalized)
        .digest();
      const stored = Buffer.from(record.codeHash, 'hex');
      if (stored.length !== digest.length) continue;
      if (timingSafeEqual(stored, digest)) {
        const { count } = await this.prisma.twoFactorRecoveryCode.updateMany({
          where: { id: record.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        return count === 1; // 0 = 并发请求已抢先消费该码
      }
    }
    return false;
  }

  /** 生成 10 个恢复码：randomBytes(10)→base32 16 字符分两段（80 位熵），SHA-256(salt‖码) 落库 */
  private generateRecoveryCodes(): {
    plain: string[];
    rows: { codeHash: string; codeSalt: string }[];
  } {
    const plain: string[] = [];
    const rows: { codeHash: string; codeSalt: string }[] = [];
    for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
      const raw = base32Encode(randomBytes(10)); // 16 字符
      plain.push(`${raw.slice(0, 8)}-${raw.slice(8)}`);
      const codeSalt = randomBytes(16).toString('hex');
      const codeHash = createHash('sha256')
        .update(codeSalt + raw)
        .digest('hex');
      rows.push({ codeHash, codeSalt });
    }
    return { plain, rows };
  }

  /** 清空用户全部 2FA 字段与恢复码（disable / force-disable 共用） */
  private async clearTwoFactor(userId: string) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecretEnc: null,
          twoFactorPendingSecretEnc: null,
          twoFactorPendingCreatedAt: null,
          twoFactorConfirmedAt: null,
          twoFactorLastStep: null,
        },
      }),
      this.prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
    ]);
  }

  /** verify 失败：审计 + per-账号计数（不累加账号级 failedLoginAttempts，防锁户 DoS） */
  private async recordFailure(sub: string, meta: RequestMeta) {
    const now = Date.now();
    const entry = this.attempts.get(sub);
    if (entry && entry.expireAt > now) {
      entry.count += 1;
    } else {
      this.attempts.set(sub, { count: 1, expireAt: now + ATTEMPT_TTL_MS });
    }
    await this.audit(sub, AUDIT.FAILED, 'auth', sub, meta);
  }

  /** 惰性清理过期的 jti 黑名单与尝试计数（≤100 用户规模，无需定时器） */
  private sweepExpired() {
    const now = Date.now();
    for (const [jti, expireAt] of this.usedJtis) {
      if (expireAt <= now) this.usedJtis.delete(jti);
    }
    for (const [sub, entry] of this.attempts) {
      if (entry.expireAt <= now) this.attempts.delete(sub);
    }
  }

  private encrypt(plaintext: string): string {
    const key = this.config.getOrThrow<string>('SECRETS_ENCRYPTION_KEY');
    return encryptString(plaintext, key, CRYPTO_CONTEXT_2FA);
  }

  private decrypt(blob: string): string {
    const key = this.config.getOrThrow<string>('SECRETS_ENCRYPTION_KEY');
    return decryptString(blob, key, CRYPTO_CONTEXT_2FA);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async audit(
    userId: string | null,
    action: string,
    resource: string,
    resourceId: string | null,
    meta: RequestMeta,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          resource,
          resourceId,
          ip: meta.ip,
          userAgent: meta.userAgent?.slice(0, 512),
          traceId: meta.traceId,
        },
      });
    } catch (e) {
      this.logger.warn(`审计日志写入失败: ${(e as Error).message}`);
    }
  }
}
