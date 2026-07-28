import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccessRoleDto, UpdateAccessRoleDto } from './dto/role.dto';
import {
  ALL_PERMISSION_IDS,
  assertValidPermissions,
  DEPRECATED_ROLE_SLUGS,
  PERMISSION_GROUPS,
  RESERVED_ROLE_SLUGS,
  ROLE_META,
  ROLE_PERMISSIONS,
  SYSTEM_ROLE_SLUGS,
  slugifyRoleName,
} from './permissions';

/** 权限缓存 TTL（5 分钟），多实例部署时保证权限变更最终一致。 */
const PERMISSION_CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  perms: string[];
  expireAt: number;
}

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger('RolesService');
  private cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.syncSystemRoles();
  }

  /** 启动时同步系统预置角色，并清理已废弃的 editor/viewer。 */
  async syncSystemRoles() {
    for (const slug of SYSTEM_ROLE_SLUGS) {
      const meta = ROLE_META[slug];
      await this.prisma.accessRole.upsert({
        where: { slug },
        create: {
          slug,
          name: meta.label,
          description: meta.description,
          permissions: [...ALL_PERMISSION_IDS],
          isSystem: true,
        },
        update: {
          name: meta.label,
          description: meta.description,
          permissions: [...ALL_PERMISSION_IDS],
          isSystem: true,
        },
      });
    }

    // 废弃角色处理：停用相关账号（而非升级为 ADMIN），等待管理员手动处理
    const deprecatedUsers = await this.prisma.user.findMany({
      where: { role: { in: [...DEPRECATED_ROLE_SLUGS] }, isActive: true },
      select: { id: true, username: true, role: true },
    });
    if (deprecatedUsers.length > 0) {
      await this.prisma.user.updateMany({
        where: { role: { in: [...DEPRECATED_ROLE_SLUGS] } },
        data: { isActive: false },
      });
      this.logger.warn(
        `已停用 ${deprecatedUsers.length} 个使用废弃角色的账号: ${deprecatedUsers.map((u) => `${u.username}(${u.role})`).join(', ')}。请管理员手动为其分配新角色后重新启用。`,
      );
    }

    await this.prisma.accessRole.deleteMany({
      where: { slug: { in: [...DEPRECATED_ROLE_SLUGS] } },
    });

    this.invalidateCache();
  }

  invalidateCache() {
    this.cache.clear();
  }

  async getPermissionsForSlug(slug: string): Promise<string[]> {
    const cached = this.cache.get(slug);
    if (cached && cached.expireAt > Date.now()) return cached.perms;

    // 过期则删除
    if (cached) this.cache.delete(slug);

    const row = await this.prisma.accessRole.findUnique({ where: { slug } });
    if (row) {
      const perms = [...row.permissions];
      this.cache.set(slug, { perms, expireAt: Date.now() + PERMISSION_CACHE_TTL_MS });
      return perms;
    }

    if (slug in ROLE_PERMISSIONS) {
      const perms = [...ROLE_PERMISSIONS[slug]!];
      this.cache.set(slug, { perms, expireAt: Date.now() + PERMISSION_CACHE_TTL_MS });
      return perms;
    }

    return [];
  }

  async assertRoleSlugExists(slug: string) {
    const row = await this.prisma.accessRole.findUnique({ where: { slug } });
    if (!row) throw new BadRequestException('所选角色不存在');
  }

  async findAllWithStats() {
    const [roles, counts] = await Promise.all([
      this.prisma.accessRole.findMany({ orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }] }),
      this.prisma.user.groupBy({
        by: ['role'],
        where: { isActive: true },
        _count: { _all: true },
      }),
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [c.role, c._count._all])) as Record<
      string,
      number
    >;

    return {
      groups: PERMISSION_GROUPS,
      roles: roles.map((r) => ({
        id: r.id,
        slug: r.slug,
        label: r.name,
        description: r.description ?? '',
        system: r.isSystem,
        userCount: countMap[r.slug] ?? 0,
        permissions: r.permissions,
      })),
    };
  }

  async findOne(id: string) {
    const role = await this.prisma.accessRole.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('角色不存在');
    return role;
  }

  private validatePermissions(permissions: string[]) {
    try {
      assertValidPermissions(permissions);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : '无效权限');
    }
  }

  async create(dto: CreateAccessRoleDto) {
    const slug = (dto.slug?.trim() || slugifyRoleName(dto.name)).toLowerCase();
    if (!slug || slug.length < 2) {
      throw new BadRequestException('无法生成有效的角色标识');
    }
    if (RESERVED_ROLE_SLUGS.has(slug)) {
      throw new ConflictException('该标识为系统保留，请使用其他名称');
    }
    this.validatePermissions(dto.permissions);
    if (dto.permissions.length === 0) {
      throw new BadRequestException('请至少选择一项权限');
    }

    const existing = await this.prisma.accessRole.findUnique({ where: { slug } });
    if (existing) throw new ConflictException('角色标识已存在');

    const role = await this.prisma.accessRole.create({
      data: {
        slug,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        permissions: dto.permissions,
        isSystem: false,
      },
    });
    this.invalidateCache();
    return role;
  }

  async update(id: string, dto: UpdateAccessRoleDto) {
    const role = await this.findOne(id);

    if (role.isSystem) {
      throw new ForbiddenException('系统预置角色不可修改');
    }

    const permissions = dto.permissions ?? role.permissions;
    this.validatePermissions(permissions);
    if (permissions.length === 0) {
      throw new BadRequestException('请至少保留一项权限');
    }

    const permissionsChanged =
      permissions.length !== role.permissions.length ||
      permissions.some((p) => !role.permissions.includes(p));

    const updated = await this.prisma.accessRole.update({
      where: { id },
      data: {
        name: dto.name?.trim() ?? role.name,
        description:
          dto.description !== undefined ? dto.description.trim() || null : role.description,
        permissions,
      },
    });

    if (permissionsChanged) {
      await this.revokeSessionsForRole(role.slug);
    }

    this.invalidateCache();
    return updated;
  }

  async remove(id: string) {
    const role = await this.findOne(id);
    if (role.isSystem) {
      throw new ForbiddenException('系统预置角色不可删除');
    }

    const userCount = await this.prisma.user.count({
      where: { role: role.slug, isActive: true },
    });
    if (userCount > 0) {
      throw new BadRequestException(`仍有 ${userCount} 个账号使用此角色，请先调整后再删除`);
    }

    await this.prisma.accessRole.delete({ where: { id } });
    this.invalidateCache();
    return { success: true };
  }

  /** 供账号表单使用的角色选项。 */
  async listOptions() {
    const roles = await this.prisma.accessRole.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      select: { slug: true, name: true, description: true, isSystem: true },
    });
    return roles.map((r) => ({
      value: r.slug,
      label: r.name,
      description: r.description,
      system: r.isSystem,
    }));
  }

  /** 角色权限变更后，强制相关用户重新登录以生效新权限。 */
  private async revokeSessionsForRole(roleSlug: string) {
    const users = await this.prisma.user.findMany({
      where: { role: roleSlug },
      select: { id: true },
    });
    if (users.length === 0) return;
    await this.prisma.session.updateMany({
      where: { userId: { in: users.map((u) => u.id) }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
