import { createHash, randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import type { MeResult } from '@tzj/types';
import * as bcrypt from 'bcrypt';
import { RolesService } from '../access/roles.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { AuthUser, JwtPayload, Role } from './roles';

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
  traceId?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // access token 秒数
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly rolesService: RolesService,
    private readonly settings: SettingsService,
  ) {}

  async login(username: string, password: string, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { username } });

    // 账号锁定检查
    if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const remainMin = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      await this.audit(user.id, 'login_locked', 'auth', user.id, meta);
      throw new ForbiddenException(`账号已临时锁定，请 ${remainMin} 分钟后重试`);
    }

    const ok = user && (await bcrypt.compare(password, user.password));
    if (!user || !ok || !user.isActive) {
      // 登录失败审计
      await this.audit(user?.id ?? null, 'login_failed', 'auth', user?.id ?? null, meta);

      // 暴力破解防护：累计失败次数
      if (user) {
        const maxAttempts = this.config.get<number>('LOGIN_MAX_ATTEMPTS') ?? 5;
        const lockDurationMin = this.config.get<number>('LOGIN_LOCK_DURATION_MIN') ?? 15;
        const attempts = user.failedLoginAttempts + 1;

        if (attempts >= maxAttempts) {
          await this.prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: 0,
              lockedUntil: new Date(Date.now() + lockDurationMin * 60_000),
            },
          });
          this.logger.warn(
            `用户 ${user.username} 连续 ${attempts} 次登录失败，已锁定 ${lockDurationMin} 分钟`,
          );
        } else {
          await this.prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: attempts },
          });
        }
      }

      // 统一模糊提示，避免用户名枚举
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 登录成功但已启用 2FA → 返回预鉴权态，不发正式令牌、不建 Session（kill-switch 打开时豁免）
    if (user.twoFactorEnabled && !this.twoFactorChallengeDisabled()) {
      const pending = await this.issuePendingToken(user.id, user.username, user.role);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
      await this.audit(user.id, 'login_2fa_challenge', 'auth', user.id, meta);
      return {
        requires2fa: true as const,
        pendingToken: pending.token,
        expiresIn: pending.expiresIn,
      };
    }

    // 登录成功：重置失败计数
    const tokens = await this.issueTokens(user.id, user.username, user.role as Role);
    await this.persistSession(user.id, tokens.refreshToken, meta);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });
    await this.audit(user.id, 'login', 'auth', user.id, meta);

    return { requires2fa: false as const, ...tokens, user: await this.toAuthUser(user) };
  }

  /** 2FA 挡板 kill-switch（TWOFA_CHALLENGE_DISABLED=true 时豁免 login 挑战与 refresh gating，事故止血用） */
  twoFactorChallengeDisabled(): boolean {
    return this.config.get<boolean>('TWOFA_CHALLENGE_DISABLED') === true;
  }

  /** 签发 2FA 预鉴权令牌（仅授予进入 verify 的资格，jti 供单用黑名单） */
  private async issuePendingToken(userId: string, username: string, role: string) {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    const expiresIn = this.config.get<number>('TWOFA_PENDING_TTL_SECONDS') ?? 300;
    const payload: JwtPayload = {
      sub: userId,
      username,
      role,
      type: 'twofa_pending',
      jti: randomUUID(),
    };
    const token = await this.jwt.signAsync({ ...payload }, { secret, expiresIn });
    return { token, expiresIn };
  }

  /** 2FA 校验通过后签发正式令牌（会话标记 twoFactorVerifiedAt，供 TwoFactorService.verify 调用） */
  async issueVerifiedSession(userId: string, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('账号不存在或已停用');
    }
    const tokens = await this.issueTokens(user.id, user.username, user.role as Role);
    await this.persistSession(user.id, tokens.refreshToken, meta, new Date());
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });
    return { ...tokens, user: await this.toAuthUser(user) };
  }

  async refresh(refreshToken: string, meta: RequestMeta): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('刷新令牌无效或已过期');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('令牌类型错误');
    }

    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.session.findUnique({ where: { tokenHash } });
    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
      // 已撤销/过期令牌被再次使用。需区分两种场景（OAuth 2.0 安全 BCP / Auth0 轮换宽限期最佳实践）：
      //  1) 合法并发竞态：刚轮换后的短窗口内，同一客户端的并发请求（中间件 + BFF 两套
      //     刷新逻辑、多标签页、多设备）仍持有旧令牌。这是正常现象，返回继任令牌即可。
      //  2) 过期令牌复用（宽限期外）：多标签页/多设备场景中，旧标签页或离线设备在重新
      //     激活时携带已轮换的旧令牌请求刷新。这是正常用户行为，不应摧毁其他活跃会话。
      //     仅拒绝本次请求（该标签页自行跳转登录），不影响其他会话。
      //  安全说明：真正的令牌盗用场景中，攻击者拿到的是「当前有效」令牌（非已撤销令牌），
      //  会走下方正常轮换路径而非此分支。因此此处无需撤销全部会话。
      if (session?.revokedAt) {
        const graceActive = session.graceUntil && session.graceUntil.getTime() > Date.now();
        if (graceActive) {
          const reused = await this.reuseWithinGrace(session, meta);
          if (reused) return reused;
          // 继任会话不可用（已过期/被撤销）→ 回落到正常失败路径（跳转登录，不撤销全部）
        } else {
          // 宽限期外的复用：仅记录安全日志，不撤销其他会话。
          // 旧标签页/设备收到 401 后自行引导用户重新登录即可。
          this.logger.warn(
            `检测到刷新令牌复用（宽限期外），仅拒绝本次请求，未撤销其他会话。` +
              ` 用户: ${session.userId}, 会话创建于: ${session.createdAt.toISOString()}`,
          );
        }
      }
      throw new UnauthorizedException('会话已失效，请重新登录');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('账号不存在或已停用');
    }

    // 2FA gating：已启用 2FA 的账号，会话必须已通过二次校验才可续期
    // （堵 refresh 绕过 2FA 的头号缺口；kill-switch 打开时同步豁免，避免事故期密码登录会话被反复踢出）
    if (
      user.twoFactorEnabled &&
      !session.twoFactorVerifiedAt &&
      !this.twoFactorChallengeDisabled()
    ) {
      throw new UnauthorizedException('会话未完成两步验证，请重新登录');
    }

    // 轮换：撤销旧会话（记录继任者 + 宽限截止时间），签发新令牌与新会话（继承 2FA 验证标记）
    const tokens = await this.issueTokens(user.id, user.username, user.role as Role);
    const newHash = this.hashToken(tokens.refreshToken);
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(),
        rotatedToHash: newHash,
        graceUntil: new Date(Date.now() + this.refreshGraceMs()),
      },
    });
    await this.persistSession(user.id, tokens.refreshToken, meta, session.twoFactorVerifiedAt);
    return tokens;
  }

  /**
   * 轮换宽限期内的合法复用：返回一组有效令牌，而非撤销全部会话。
   *
   * 背景：前端存在两套独立刷新逻辑（中间件页面导航 + BFF API 代理），且多标签页/多设备
   * 各自持有内存单飞锁、互不共享。access token 过期瞬间，多个请求可能并发携带同一
   * refresh token 发起轮换：第一个成功轮换并撤销旧令牌，其余请求随即命中「已撤销」。
   * 若一律按盗用处理撤销全部会话，坐席会被频繁强制登出。
   *
   * 策略：宽限期（默认 10s，可配 JWT_REFRESH_GRACE_SECONDS）内复用视为竞态——
   * 签发一组新令牌并新建会话（不撤销任何现存会话），同时把旧会话的 rotatedToHash
   * 指向新会话，保证后续复用总能找到可用继任者。宽限期外的复用才判定为盗用。
   */
  private async reuseWithinGrace(
    session: { id: string; userId: string; twoFactorVerifiedAt: Date | null },
    meta: RequestMeta,
  ): Promise<TokenPair | null> {
    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || !user.isActive) return null;
    // 宽限期复用同样受 2FA gating 约束（新建 Session 继承验证标记，避免合法竞态复用者下次 refresh 被误踢）
    if (
      user.twoFactorEnabled &&
      !session.twoFactorVerifiedAt &&
      !this.twoFactorChallengeDisabled()
    ) {
      return null;
    }
    const tokens = await this.issueTokens(user.id, user.username, user.role as Role);
    await this.persistSession(user.id, tokens.refreshToken, meta, session.twoFactorVerifiedAt);
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        rotatedToHash: this.hashToken(tokens.refreshToken),
        graceUntil: new Date(Date.now() + this.refreshGraceMs()),
      },
    });
    this.logger.log(
      `用户 ${user.id} 在轮换宽限期内复用刷新令牌（并发竞态），已签发新令牌，未撤销会话`,
    );
    return tokens;
  }

  /** 轮换宽限期毫秒数（默认 10s，环境变量 JWT_REFRESH_GRACE_SECONDS 可配）。 */
  private refreshGraceMs(): number {
    const sec = this.config.get<number>('JWT_REFRESH_GRACE_SECONDS') ?? 10;
    return sec * 1000;
  }

  async logout(refreshToken: string | undefined, meta: RequestMeta) {
    if (!refreshToken) return { success: true };
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.session.findUnique({ where: { tokenHash } });
    if (session && !session.revokedAt) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      await this.audit(session.userId, 'logout', 'auth', session.userId, meta);
    }
    return { success: true };
  }

  async me(userId: string): Promise<MeResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    // 强制 2FA 引导标记：开关打开且本人未绑定（kill-switch 打开时不引导，与守卫豁免口径一致）
    let twoFactorSetupRequired = false;
    if (!user.twoFactorEnabled && !this.twoFactorChallengeDisabled()) {
      const { twoFactorRequired } = await this.settings.getSecurityAuthSettings();
      twoFactorSetupRequired = twoFactorRequired;
    }
    return { ...(await this.toAuthUser(user)), twoFactorSetupRequired };
  }

  async updateProfile(
    userId: string,
    data: { nickname?: string; email?: string; phone?: string },
  ): Promise<AuthUser> {
    if (data.email) {
      const dup = await this.prisma.user.findFirst({
        where: { email: data.email, NOT: { id: userId } },
      });
      if (dup) throw new ConflictException('邮箱已被使用');
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        nickname: data.nickname,
        email: data.email,
        phone: data.phone,
      },
    });
    return await this.toAuthUser(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) throw new UnauthorizedException('当前密码不正确');

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: await bcrypt.hash(newPassword, 12) },
    });
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  // ── 内部工具 ─────────────────────────────────────────
  private async issueTokens(userId: string, username: string, role: Role): Promise<TokenPair> {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL') ?? '15m';
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL') ?? '7d';

    const base: JwtPayload = { sub: userId, username, role };
    const accessOpts: JwtSignOptions = {
      secret,
      expiresIn: accessTtl as JwtSignOptions['expiresIn'],
    };
    const refreshOpts: JwtSignOptions = {
      secret,
      expiresIn: refreshTtl as JwtSignOptions['expiresIn'],
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync({ ...base, type: 'access' }, accessOpts),
      this.jwt.signAsync({ ...base, type: 'refresh' }, refreshOpts),
    ]);
    return {
      accessToken,
      refreshToken,
      expiresIn: this.ttlToSeconds(accessTtl),
    };
  }

  private async persistSession(
    userId: string,
    refreshToken: string,
    meta: RequestMeta,
    twoFactorVerifiedAt?: Date | null,
  ) {
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL') ?? '7d';
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        userAgent: meta.userAgent?.slice(0, 512),
        ip: meta.ip,
        expiresAt: new Date(Date.now() + this.ttlToSeconds(refreshTtl) * 1000),
        twoFactorVerifiedAt: twoFactorVerifiedAt ?? null,
      },
    });
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

  private async toAuthUser(user: {
    id: string;
    username: string;
    role: string;
    nickname: string | null;
    email?: string | null;
    phone?: string | null;
  }): Promise<AuthUser> {
    const permissions = await this.rolesService.getPermissionsForSlug(user.role);
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      permissions,
      nickname: user.nickname,
      email: user.email ?? null,
      phone: user.phone ?? null,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private ttlToSeconds(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl.trim());
    if (!match) {
      const n = Number(ttl);
      return Number.isFinite(n) ? n : 900;
    }
    const value = Number(match[1] ?? '0');
    const unit = match[2] ?? 's';
    const map: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (map[unit] ?? 1);
  }

  // ── 会话管理 ─────────────────────────────────────────

  /** 获取当前用户活跃会话列表 */
  async getSessions(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        ip: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
    });
    return sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ip: s.ip,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
    }));
  }

  /** 撤销指定会话（仅限自己的） */
  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId, revokedAt: null },
    });
    if (!session) {
      throw new UnauthorizedException('会话不存在或已失效');
    }
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  /** 撤销其他所有会话（保留当前会话） */
  async revokeOtherSessions(userId: string, currentRefreshToken?: string) {
    const currentTokenHash = currentRefreshToken ? this.hashToken(currentRefreshToken) : null;
    await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }
}
