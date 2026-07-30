import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import {
  ALL_PERMISSION_IDS,
  assertValidPermissions,
  PRESET_ROLES,
  RESERVED_ROLE_SLUGS,
} from './permissions';
import { RolesService } from './roles.service';

/**
 * 相邻提权硬校验回归（docs/security/account-recovery-design.md §7）：
 * 角色创建/更新/删除必须在 service 层查库确认操作者 role === 'admin'，
 * 仅持 access.manage 权限的非 admin 用户一律 403；admin 行为不变。
 */

const ADMIN_ID = 'u-admin';
const OPS_ID = 'u-ops'; // 非 admin，但其角色被授予了 access.manage
const INACTIVE_ADMIN_ID = 'u-frozen';

interface RoleRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
}

function buildFakePrisma(roles: RoleRow[], settings: Record<string, unknown> = {}) {
  const users: Record<string, { role: string; isActive: boolean }> = {
    [ADMIN_ID]: { role: 'admin', isActive: true },
    [OPS_ID]: { role: 'ops', isActive: true },
    [INACTIVE_ADMIN_ID]: { role: 'admin', isActive: false },
  };
  const writes: string[] = [];
  const prisma = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => users[where.id] ?? null,
      findMany: async () => [],
      count: async () => 0,
    },
    accessRole: {
      findUnique: async ({ where }: { where: { id?: string; slug?: string } }) =>
        roles.find((r) => (where.id ? r.id === where.id : r.slug === where.slug)) ?? null,
      create: async ({ data }: { data: Omit<RoleRow, 'id'> }) => {
        writes.push('create');
        const row = { id: `new-${data.slug}`, ...data };
        roles.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<RoleRow> }) => {
        writes.push('update');
        const found = roles.find((r) => r.id === where.id);
        return { ...(found ?? CUSTOM_ROLE), ...data };
      },
      delete: async () => {
        writes.push('delete');
        return {};
      },
    },
    setting: {
      findUnique: async ({ where }: { where: { key: string } }) =>
        where.key in settings ? { key: where.key, value: settings[where.key] } : null,
      upsert: async ({ where, create }: { where: { key: string }; create: { value: unknown } }) => {
        writes.push('setting-upsert');
        settings[where.key] = create.value;
        return { key: where.key, value: create.value };
      },
    },
    session: {
      updateMany: async () => ({ count: 0 }),
    },
  };
  return { prisma: prisma as unknown as PrismaService, writes, roles, settings };
}

const CUSTOM_ROLE: RoleRow = {
  id: 'r1',
  slug: 'ops',
  name: '运营',
  description: null,
  permissions: ['chat.view'],
  isSystem: false,
};

describe('RolesService.getPermissionsForSlug', () => {
  it('admin 恒返回代码全量权限，即使库行缺失新权限点', async () => {
    const staleAdmin: RoleRow = {
      id: 'r-admin',
      slug: 'admin',
      name: '超级管理员',
      description: null,
      permissions: ['content.view'], // 故意残缺，模拟灵犀上线前的生产快照
      isSystem: true,
    };
    const { prisma } = buildFakePrisma([staleAdmin]);
    const service = new RolesService(prisma);

    const perms = await service.getPermissionsForSlug('admin');
    expect(perms).toEqual([...ALL_PERMISSION_IDS]);
    expect(perms).toContain('lingxi.use');
  });

  it('非 admin 角色仍优先吃数据库行', async () => {
    const { prisma } = buildFakePrisma([CUSTOM_ROLE]);
    const service = new RolesService(prisma);

    await expect(service.getPermissionsForSlug('ops')).resolves.toEqual(['chat.view']);
  });
});

describe('RolesService 角色写操作 admin 硬校验（防相邻提权）', () => {
  const createDto = { name: '测试角色', slug: 'test-role', permissions: ['chat.view'] };

  it('非 admin（持 access.manage）/停用 admin/不存在用户：create/update/remove 一律 403 且不落库', async () => {
    const invalidActors: string[] = [OPS_ID, INACTIVE_ADMIN_ID, 'u-ghost'];
    for (const actorId of invalidActors) {
      const { prisma, writes } = buildFakePrisma([CUSTOM_ROLE]);
      const service = new RolesService(prisma);

      await expect(service.create(createDto, actorId)).rejects.toThrow(ForbiddenException);
      await expect(
        service.update('r1', { permissions: ['chat.view', 'users.manage'] }, actorId),
      ).rejects.toThrow(ForbiddenException);
      await expect(service.remove('r1', actorId)).rejects.toThrow(ForbiddenException);
      expect(writes).toEqual([]);
    }
  });

  it('admin 创建角色：放行（回归）', async () => {
    const { prisma, writes } = buildFakePrisma([CUSTOM_ROLE]);
    const service = new RolesService(prisma);

    const role = await service.create(createDto, ADMIN_ID);
    expect(role.slug).toBe('test-role');
    expect(writes).toEqual(['create']);
  });

  it('admin 更新自定义角色：放行（回归）', async () => {
    const { prisma, writes } = buildFakePrisma([CUSTOM_ROLE]);
    const service = new RolesService(prisma);

    const updated = await service.update('r1', { permissions: ['chat.view'] }, ADMIN_ID);
    expect(updated.id).toBe('r1');
    expect(writes).toEqual(['update']);
  });

  it('admin 删除无人使用的自定义角色：放行（回归）', async () => {
    const { prisma, writes } = buildFakePrisma([CUSTOM_ROLE]);
    const service = new RolesService(prisma);

    await expect(service.remove('r1', ADMIN_ID)).resolves.toEqual({ success: true });
    expect(writes).toEqual(['delete']);
  });

  it('admin 也不能改系统预置角色（既有约束不受影响）', async () => {
    const { prisma } = buildFakePrisma([
      { ...CUSTOM_ROLE, id: 'r2', slug: 'admin', isSystem: true },
    ]);
    const service = new RolesService(prisma);

    await expect(service.update('r2', { permissions: ['chat.view'] }, ADMIN_ID)).rejects.toThrow(
      '系统预置角色不可修改',
    );
  });
});

/**
 * 预置业务角色（docs/rbac-preset-roles-design.md §5.1）：
 * 静态红线断言 + 播种幂等（只播一次、不覆盖、删后不复活）。
 */
describe('PRESET_ROLES 静态校验（职责分离与删除红线）', () => {
  /** 不可恢复删除：不得出现在任何预设（取舍 1） */
  const IRREVERSIBLE_DELETES = [
    'media.purge',
    'contacts.delete',
    'customers.delete',
    'chat.delete',
    'tickets.delete',
    'docs.delete',
  ];
  /** 回收站语义删除：仅允许 marketing-ops 持有 */
  const RECOVERABLE_DELETES = ['content.delete', 'media.delete'];

  it('所有权限 id 合法且非空', () => {
    for (const preset of PRESET_ROLES) {
      expect(preset.permissions.length).toBeGreaterThan(0);
      expect(() => assertValidPermissions(preset.permissions)).not.toThrow();
    }
  });

  it('slug 无重复、不与系统保留 slug 冲突', () => {
    const slugs = PRESET_ROLES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(RESERVED_ROLE_SLUGS.has(slug)).toBe(false);
    }
  });

  it('职责分离红线：系统管理/安全/集成类权限不进任何预设', () => {
    for (const preset of PRESET_ROLES) {
      for (const perm of preset.permissions) {
        expect(perm).not.toBe('users.manage');
        expect(perm.startsWith('access.')).toBe(false);
        expect(perm.startsWith('security.')).toBe(false);
        expect(perm.startsWith('integrations.')).toBe(false);
      }
    }
  });

  it('删除红线：不可恢复删除不进预设，回收站删除仅允许 marketing-ops', () => {
    for (const preset of PRESET_ROLES) {
      for (const perm of IRREVERSIBLE_DELETES) {
        expect(preset.permissions).not.toContain(perm);
      }
      if (preset.slug !== 'marketing-ops') {
        for (const perm of RECOVERABLE_DELETES) {
          expect(preset.permissions).not.toContain(perm);
        }
      }
    }
  });

  it('chat.view 事实为坐席能力，仅允许出现在 support（取舍 4）', () => {
    for (const preset of PRESET_ROLES) {
      if (preset.slug === 'support') continue;
      expect(preset.permissions).not.toContain('chat.view');
    }
  });

  it('含 docs.create 的预设必须同时含 docs.edit，防「能建不能改」（取舍 7）', () => {
    for (const preset of PRESET_ROLES) {
      if (preset.permissions.includes('docs.create')) {
        expect(preset.permissions).toContain('docs.edit');
      }
    }
  });
});

describe('seedPresetRoles 播种：只播一次、不覆盖、删后不复活', () => {
  const SEED_KEY = 'access.presetRolesSeededAt';

  it('首次播种：创建全部预设（isSystem=false）并写标记', async () => {
    const { prisma, writes, roles, settings } = buildFakePrisma([]);
    const service = new RolesService(prisma);

    await service.seedPresetRoles();

    expect(writes.filter((w) => w === 'create')).toHaveLength(PRESET_ROLES.length);
    expect(writes).toContain('setting-upsert');
    expect(settings[SEED_KEY]).toBeDefined();
    for (const preset of PRESET_ROLES) {
      const row = roles.find((r) => r.slug === preset.slug);
      expect(row).toBeDefined();
      expect(row?.isSystem).toBe(false);
      expect(row?.permissions).toEqual(preset.permissions);
    }
  });

  it('标记已存在：零写入（幂等，删掉的预设不复活）', async () => {
    const { prisma, writes } = buildFakePrisma([], {
      [SEED_KEY]: '2026-07-29T00:00:00.000Z',
    });
    const service = new RolesService(prisma);

    await service.seedPresetRoles();

    expect(writes).toEqual([]);
  });

  it('slug 已被自定义角色占用：跳过该条不覆盖，其余照常创建', async () => {
    const occupied: RoleRow = {
      id: 'r-occupied',
      slug: 'sales',
      name: '自定义销售',
      description: null,
      permissions: ['contacts.view'],
      isSystem: false,
    };
    const { prisma, writes, roles } = buildFakePrisma([occupied]);
    const service = new RolesService(prisma);

    await service.seedPresetRoles();

    expect(writes.filter((w) => w === 'create')).toHaveLength(PRESET_ROLES.length - 1);
    // 既有角色未被覆盖
    const salesRow = roles.find((r) => r.slug === 'sales');
    expect(salesRow?.id).toBe('r-occupied');
    expect(salesRow?.permissions).toEqual(['contacts.view']);
  });
});
