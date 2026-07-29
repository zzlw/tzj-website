import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { RolesService } from '../access/roles.service';
import type { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

/**
 * 账号恢复方案后端加固回归（docs/security/account-recovery-design.md §4.3/§6）：
 * - G5 统一 admin 硬校验：create/update/remove/resetPassword 四端点同口径；
 * - G3 收敛改密入口：update 不再读取 password 字段；
 * - G4 专属语义审计：resetPassword 写 user_password_reset；
 * - G6 重置即解锁：resetPassword 同步清 failedLoginAttempts/lockedUntil。
 */

jest.mock('bcrypt', () => ({
  hash: async (plain: string) => `hashed:${plain}`,
  compare: async (plain: string, hashed: string) => hashed === `hashed:${plain}`,
}));

const ADMIN_ID = 'u-admin';
const ADMIN2_ID = 'u-admin2';
const OPS_ID = 'u-ops'; // 非 admin，但其角色被授予了 users.manage

interface UserRow {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  password: string;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

function buildUsers(): Record<string, UserRow> {
  const base = {
    email: null,
    phone: null,
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
  };
  return {
    [ADMIN_ID]: {
      ...base,
      id: ADMIN_ID,
      username: 'admin',
      role: 'admin',
      password: 'hashed:Admin@123456',
    },
    [ADMIN2_ID]: {
      ...base,
      id: ADMIN2_ID,
      username: 'admin2',
      role: 'admin',
      password: 'hashed:Admin2@123456',
    },
    [OPS_ID]: {
      ...base,
      id: OPS_ID,
      username: 'ops01',
      role: 'ops',
      password: 'hashed:Ops@123456',
      failedLoginAttempts: 5,
      lockedUntil: new Date('2099-01-01T00:00:00Z'),
    },
  };
}

function buildFakePrisma(users: Record<string, UserRow>) {
  const audits: Array<{ action: string; resource: string; resourceId: string; userId: string }> =
    [];
  const sessionRevokes: string[] = [];
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];

  const prisma = {
    user: {
      findUnique: async ({ where }: { where: { id?: string; username?: string } }) => {
        if (where.id) return users[where.id] ?? null;
        return Object.values(users).find((u) => u.username === where.username) ?? null;
      },
      findFirst: async ({ where }: { where: { email?: string; phone?: string } }) =>
        Object.values(users).find((u) =>
          where.email !== undefined ? u.email === where.email : u.phone === where.phone,
        ) ?? null,
      count: async ({ where }: { where: { id?: { not?: string } } }) =>
        Object.values(users).filter(
          (u) => u.role === 'admin' && u.isActive && u.id !== where.id?.not,
        ).length,
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: 'u-new', ...data }),
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        updates.push({ id: where.id, data });
        const row = users[where.id];
        if (row) Object.assign(row, data);
        return { ...row, ...data };
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const row = users[where.id];
        delete users[where.id];
        return row;
      },
    },
    session: {
      updateMany: async ({ where }: { where: { userId: string } }) => {
        sessionRevokes.push(where.userId);
        return { count: 1 };
      },
    },
    auditLog: {
      create: async ({ data }: { data: (typeof audits)[number] }) => {
        audits.push(data);
        return data;
      },
    },
  };
  return { prisma: prisma as unknown as PrismaService, audits, sessionRevokes, updates };
}

const rolesServiceStub = {
  assertRoleSlugExists: async () => undefined,
} as unknown as RolesService;

function buildService() {
  const users = buildUsers();
  const fake = buildFakePrisma(users);
  const service = new UsersService(fake.prisma, rolesServiceStub);
  return { service, users, ...fake };
}

describe('UsersService 账号恢复加固（G3/G4/G5/G6）', () => {
  describe('resetPassword', () => {
    it('成功路径：写 user_password_reset 专属审计 + 撤销会话（G4）', async () => {
      const { service, audits, sessionRevokes } = buildService();
      await expect(
        service.resetPassword(OPS_ID, { password: 'NewPass@123456' }, ADMIN_ID),
      ).resolves.toEqual({ success: true });
      expect(audits).toEqual([
        { userId: ADMIN_ID, action: 'user_password_reset', resource: 'users', resourceId: OPS_ID },
      ]);
      expect(sessionRevokes).toEqual([OPS_ID]);
    });

    it('重置后清零失败计数并解锁（G6）', async () => {
      const { service, users } = buildService();
      await service.resetPassword(OPS_ID, { password: 'NewPass@123456' }, ADMIN_ID);
      expect(users[OPS_ID]!.failedLoginAttempts).toBe(0);
      expect(users[OPS_ID]!.lockedUntil).toBeNull();
      expect(users[OPS_ID]!.password).toBe('hashed:NewPass@123456');
    });

    it('目标为 ADMIN 且缺 actorPassword → 400（既有行为回归）', async () => {
      const { service } = buildService();
      await expect(
        service.resetPassword(ADMIN2_ID, { password: 'NewPass@123456' }, ADMIN_ID),
      ).rejects.toThrow('重置管理员密码需要提供您的当前密码');
    });

    it('非 admin 操作者（持 users.manage）对 ADMIN 目标重置 → 403（G5）', async () => {
      const { service, updates } = buildService();
      await expect(
        service.resetPassword(
          ADMIN_ID,
          { password: 'NewPass@123456', actorPassword: 'Ops@123456' },
          OPS_ID,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(updates).toEqual([]);
    });
  });

  describe('G5 统一 admin 硬校验', () => {
    it('非 admin：create role=admin → 403 且不落库', async () => {
      const { service } = buildService();
      await expect(
        service.create({ username: 'evil', password: 'Evil@123456', role: 'admin' }, OPS_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('非 admin：update 将他人 role 改为 admin → 403', async () => {
      const { service, users } = buildService();
      users['u-other'] = { ...buildUsers()[OPS_ID]!, id: 'u-other', username: 'other' };
      await expect(service.update('u-other', { role: 'admin' }, OPS_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('非 admin：update 对 ADMIN 目标写 lockedUntil / isActive → 403', async () => {
      const { service } = buildService();
      await expect(
        service.update(ADMIN_ID, { lockedUntil: '2099-01-01T00:00:00Z' }, OPS_ID),
      ).rejects.toThrow(ForbiddenException);
      await expect(service.update(ADMIN_ID, { isActive: false }, OPS_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('非 admin：remove ADMIN 目标 → 403', async () => {
      const { service, users } = buildService();
      await expect(service.remove(ADMIN2_ID, OPS_ID)).rejects.toThrow(ForbiddenException);
      expect(users[ADMIN2_ID]).toBeDefined();
    });

    it('任意操作者（含 admin）修改自己的 role → 400', async () => {
      const { service } = buildService();
      await expect(service.update(ADMIN_ID, { role: 'ops' }, ADMIN_ID)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.update(OPS_ID, { role: 'admin' }, OPS_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('admin 操作者回归：create admin / update ADMIN / remove ADMIN 全放行', async () => {
      const { service, users } = buildService();
      await expect(
        service.create({ username: 'admin3', password: 'Admin3@123456', role: 'admin' }, ADMIN_ID),
      ).resolves.toMatchObject({ username: 'admin3' });
      await expect(
        service.update(ADMIN2_ID, { nickname: '备份管理员' }, ADMIN_ID),
      ).resolves.toBeDefined();
      await expect(service.remove(ADMIN2_ID, ADMIN_ID)).resolves.toEqual({ success: true });
      expect(users[ADMIN2_ID]).toBeUndefined();
    });
  });

  describe('G3 收敛改密入口', () => {
    it('update payload 仅含 password：密码不变、会话不撤销（不依赖 whitelist）', async () => {
      const { service, users, sessionRevokes } = buildService();
      const before = users[OPS_ID]!.password;
      // 模拟旧前端残留请求：whitelist:false 下多余字段会到达 service
      await service.update(OPS_ID, { password: 'Sneaky@123456' } as never, ADMIN_ID);
      expect(users[OPS_ID]!.password).toBe(before);
      expect(sessionRevokes).toEqual([]);
    });
  });
});

describe('UsersService 多标识登录治理（docs/login-multi-identifier-and-2fa-guide-design.md §3.2.1/§3.4）', () => {
  describe('username 白名单（仅新建/改名校验）', () => {
    it('create：11 位手机号形态用户名 → 400（防标识碰撞锁户 DoS）', async () => {
      const { service } = buildService();
      await expect(
        service.create({ username: '13800138000', password: 'Pass@123456', role: 'ops' }, ADMIN_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('create：含非法字符（@）的用户名 → 400', async () => {
      const { service } = buildService();
      await expect(
        service.create({ username: 'a@b.com', password: 'Pass@123456', role: 'ops' }, ADMIN_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('update：存量违规用户名原样回填（值未变）放行，改名为违规形态 → 400', async () => {
      const { service, users } = buildService();
      // 模拟 seed 超管：username 为邮箱形态的存量账号
      users['u-legacy'] = {
        ...buildUsers()[OPS_ID]!,
        id: 'u-legacy',
        username: 'boss@example.com',
        role: 'ops',
      };
      await expect(
        service.update('u-legacy', { username: 'boss@example.com', nickname: '老板' }, ADMIN_ID),
      ).resolves.toBeDefined();
      await expect(
        service.update('u-legacy', { username: '13800138000' }, ADMIN_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('phone 归一化与查重', () => {
    it('create：+86 前缀/空格归一化后落库', async () => {
      const { service } = buildService();
      await expect(
        service.create(
          { username: 'sales01', password: 'Pass@123456', role: 'ops', phone: '+86 138 0013 8000' },
          ADMIN_ID,
        ),
      ).resolves.toMatchObject({ phone: '13800138000' });
    });

    it('create：非大陆手机号形态 → 400；重复手机号 → 409', async () => {
      const { service, users } = buildService();
      await expect(
        service.create(
          { username: 'sales02', password: 'Pass@123456', role: 'ops', phone: '0371-1234567' },
          ADMIN_ID,
        ),
      ).rejects.toThrow(BadRequestException);
      users[OPS_ID]!.phone = '13800138000';
      await expect(
        service.create(
          { username: 'sales03', password: 'Pass@123456', role: 'ops', phone: '13800138000' },
          ADMIN_ID,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('update：存量非标号码原样回填（值未变）放行，改为新号码时才校验格式', async () => {
      const { service, users } = buildService();
      users[OPS_ID]!.phone = '0371-1234567'; // 历史座机号
      await expect(
        service.update(OPS_ID, { phone: '0371-1234567', nickname: '运营' }, ADMIN_ID),
      ).resolves.toBeDefined();
      await expect(service.update(OPS_ID, { phone: 'not-a-phone' }, ADMIN_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('update：改为他人已占用的手机号 → 409', async () => {
      const { service, users } = buildService();
      users[ADMIN2_ID]!.phone = '13900139000';
      await expect(service.update(OPS_ID, { phone: '139 0013 9000' }, ADMIN_ID)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
