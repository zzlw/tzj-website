import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { RolesService } from '../access/roles.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { SettingsService } from '../settings/settings.service';
import { AuthService } from './auth.service';

/**
 * 多标识登录回归（docs/login-multi-identifier-and-2fa-guide-design.md §3.2/§六）：
 * - 用户名 / 邮箱（大小写、空白归一）/ 手机号（+86、空格连字符归一）三种标识登录；
 * - 确定性优先级：username 命中优先于 phone（A 用户名 = B 手机号的碰撞场景）；
 * - miss 口径统一「账号或密码错误」，失败计数 / 锁定 / 2FA 挑战与既往一致；
 * - updateProfile 的 phone 归一化 + 查重 + 值未变化放行。
 */

jest.mock('bcrypt', () => ({
  hash: async (plain: string) => `hashed:${plain}`,
  compare: async (plain: string, hashed: string) => hashed === `hashed:${plain}`,
}));

interface UserRow {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  nickname: string | null;
  role: string;
  isActive: boolean;
  password: string;
  twoFactorEnabled: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

function buildUsers(): Record<string, UserRow> {
  const base = {
    nickname: null,
    role: 'ops',
    isActive: true,
    twoFactorEnabled: false,
    failedLoginAttempts: 0,
    lockedUntil: null,
  };
  return {
    'u-alice': {
      ...base,
      id: 'u-alice',
      username: 'alice',
      email: 'alice@example.com',
      phone: '13800138000',
      password: 'hashed:Alice@123456',
    },
    // 碰撞场景：bob 的用户名恰好是 alice 的手机号形态之外的另一个 11 位号（存量数据）
    'u-bob': {
      ...base,
      id: 'u-bob',
      username: '13900139000',
      email: null,
      phone: null,
      password: 'hashed:Bob@123456',
    },
    // carol 的 phone 与 bob 的 username 相同 → username 优先命中 bob
    'u-carol': {
      ...base,
      id: 'u-carol',
      username: 'carol',
      email: null,
      phone: '13900139000',
      password: 'hashed:Carol@123456',
    },
    'u-2fa': {
      ...base,
      id: 'u-2fa',
      username: 'secure',
      email: 'secure@example.com',
      phone: null,
      twoFactorEnabled: true,
      password: 'hashed:Secure@123456',
    },
  };
}

function buildFakePrisma(users: Record<string, UserRow>) {
  const audits: Array<{ action: string; userId: string | null }> = [];
  const sessions: Array<Record<string, unknown>> = [];

  const prisma = {
    user: {
      findUnique: async ({
        where,
      }: {
        where: { id?: string; username?: string; email?: string; phone?: string };
      }) => {
        if (where.id) return users[where.id] ?? null;
        return (
          Object.values(users).find((u) =>
            where.username !== undefined
              ? u.username === where.username
              : where.email !== undefined
                ? u.email === where.email
                : u.phone === where.phone,
          ) ?? null
        );
      },
      findFirst: async ({
        where,
      }: {
        where: { email?: string; phone?: string; NOT?: { id: string } };
      }) =>
        Object.values(users).find(
          (u) =>
            u.id !== where.NOT?.id &&
            (where.email !== undefined ? u.email === where.email : u.phone === where.phone),
        ) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = users[where.id];
        if (row) Object.assign(row, data);
        return { ...row, ...data };
      },
    },
    session: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        sessions.push(data);
        return data;
      },
    },
    auditLog: {
      create: async ({ data }: { data: (typeof audits)[number] }) => {
        audits.push(data);
        return data;
      },
    },
  };
  return { prisma: prisma as unknown as PrismaService, audits, sessions };
}

const jwtStub = {
  signAsync: async () => 'signed-token',
} as unknown as JwtService;

const configStub = {
  get: () => undefined, // 全部走默认值（maxAttempts=5、lock=15min、TTL 默认）
  getOrThrow: () => 'test-secret',
} as unknown as ConfigService;

const rolesServiceStub = {
  getPermissionsForSlug: async () => [],
} as unknown as RolesService;

const settingsStub = {
  getSecurityAuthSettings: async () => ({ twoFactorRequired: false }),
} as unknown as SettingsService;

function buildService() {
  const users = buildUsers();
  const fake = buildFakePrisma(users);
  const service = new AuthService(fake.prisma, jwtStub, configStub, rolesServiceStub, settingsStub);
  return { service, users, ...fake };
}

const meta = { ip: '127.0.0.1', userAgent: 'jest' };

describe('AuthService 多标识登录（§3.2）', () => {
  it('用户名登录成功（既往行为回归）', async () => {
    const { service } = buildService();
    await expect(service.login('alice', 'Alice@123456', meta)).resolves.toMatchObject({
      requires2fa: false,
      user: { id: 'u-alice', username: 'alice' },
    });
  });

  it('邮箱登录成功：大小写与首尾空白归一化', async () => {
    const { service } = buildService();
    await expect(service.login(' Alice@Example.COM ', 'Alice@123456', meta)).resolves.toMatchObject(
      { user: { id: 'u-alice' } },
    );
  });

  it('手机号登录成功：+86 前缀与空格归一化', async () => {
    const { service } = buildService();
    await expect(service.login('+86 138 0013 8000', 'Alice@123456', meta)).resolves.toMatchObject({
      user: { id: 'u-alice' },
    });
  });

  it('优先级碰撞：标识同为 bob 的用户名与 carol 的手机号 → username 优先命中 bob', async () => {
    const { service } = buildService();
    // bob 的密码校验通过 → 命中的是 bob 而非 carol
    await expect(service.login('13900139000', 'Bob@123456', meta)).resolves.toMatchObject({
      user: { id: 'u-bob' },
    });
    // 用 carol 的密码则失败（不会回退到 phone 匹配），错误口径统一
    await expect(service.login('13900139000', 'Carol@123456', meta)).rejects.toThrow(
      '账号或密码错误',
    );
  });

  it('三种标识 miss 口径一致：均抛「账号或密码错误」', async () => {
    const { service } = buildService();
    for (const identifier of ['nobody', 'nobody@example.com', '13111111111']) {
      await expect(service.login(identifier, 'whatever', meta)).rejects.toThrow('账号或密码错误');
    }
  });

  it('邮箱登录密码错误：归属账号失败计数 +1（防护路径与用户名口径一致）', async () => {
    const { service, users } = buildService();
    await expect(service.login('alice@example.com', 'wrong', meta)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(users['u-alice']!.failedLoginAttempts).toBe(1);
  });

  it('手机号登录连续失败达阈值 → 锁定，再登录提示锁定文案', async () => {
    const { service, users } = buildService();
    users['u-alice']!.failedLoginAttempts = 4; // 默认 maxAttempts=5，本次失败为第 5 次
    await expect(service.login('13800138000', 'wrong', meta)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(users['u-alice']!.lockedUntil).toBeInstanceOf(Date);
    await expect(service.login('13800138000', 'Alice@123456', meta)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('2FA 用户经邮箱登录 → 返回预鉴权态而非正式令牌', async () => {
    const { service, sessions } = buildService();
    const result = await service.login('secure@example.com', 'Secure@123456', meta);
    expect(result).toMatchObject({ requires2fa: true });
    expect((result as { pendingToken?: string }).pendingToken).toBe('signed-token');
    expect(sessions).toEqual([]); // 预鉴权态不建 Session
  });
});

describe('AuthService.updateProfile phone 治理（§3.4）', () => {
  it('新手机号归一化后落库', async () => {
    const { service, users } = buildService();
    await service.updateProfile('u-carol', { phone: '+86 137 0013 7000' });
    expect(users['u-carol']!.phone).toBe('13700137000');
  });

  it('格式非法 → 400；他人已占用 → 409', async () => {
    const { service } = buildService();
    await expect(service.updateProfile('u-carol', { phone: 'not-a-phone' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.updateProfile('u-carol', { phone: '138-0013-8000' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('存量值原样回填（值未变化）放行，不触发格式校验', async () => {
    const { service, users } = buildService();
    users['u-carol']!.phone = '0371-1234567'; // 历史座机号
    await expect(
      service.updateProfile('u-carol', { phone: '0371-1234567', nickname: '客服' }),
    ).resolves.toBeDefined();
    expect(users['u-carol']!.phone).toBe('0371-1234567');
  });

  it('email 写入统一小写归一化', async () => {
    const { service, users } = buildService();
    await service.updateProfile('u-carol', { email: ' Carol@Example.COM ' });
    expect(users['u-carol']!.email).toBe('carol@example.com');
  });
});
