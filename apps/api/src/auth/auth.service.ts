import { createHash } from 'node:crypto';
import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RolesService } from '../access/roles.service';
import { PrismaService } from '../prisma/prisma.service';
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
  ) {}

  async login(username: string, password: string, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    const ok = user && (await bcrypt.compare(password, user.password));
    if (!user || !ok || !user.isActive) {
      // 统一模糊提示，避免用户名枚举
      throw new UnauthorizedException('用户名或密码错误');
    }

    const tokens = await this.issueTokens(user.id, user.username, user.role as Role);
    await this.persistSession(user.id, tokens.refreshToken, meta);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.audit(user.id, 'login', 'auth', user.id, meta);

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
      // 重放/复用检测：命中已撤销令牌时，撤销该用户全部会话
      if (session?.revokedAt) {
        await this.prisma.session.updateMany({
          where: { userId: session.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        this.logger.warn(`检测到刷新令牌复用，已撤销用户 ${session.userId} 的所有会话`);
      }
      throw new UnauthorizedException('会话已失效，请重新登录');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('账号不存在或已停用');
    }

    // 轮换：撤销旧会话，签发新令牌与新会话
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    const tokens = await this.issueTokens(user.id, user.username, user.role as Role);
    await this.persistSession(user.id, tokens.refreshToken, meta);
    return tokens;
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

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return await this.toAuthUser(user);
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

  private async persistSession(userId: string, refreshToken: string, meta: RequestMeta) {
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL') ?? '7d';
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        userAgent: meta.userAgent?.slice(0, 512),
        ip: meta.ip,
        expiresAt: new Date(Date.now() + this.ttlToSeconds(refreshTtl) * 1000),
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
}
