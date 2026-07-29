import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client/index';
import * as bcrypt from 'bcrypt';
import { RolesService } from '../access/roles.service';
import { Role } from '../auth/roles';
import { normalizeEmail, normalizePhone, USERNAME_PATTERN } from '../common/utils/identifier';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, ResetUserPasswordDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger('UsersService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly rolesService: RolesService,
  ) {}

  async findAll(params: { page: number; limit: number; search?: string; role?: string }) {
    const { page, limit, search, role } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { nickname: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        select: {
          id: true,
          username: true,
          nickname: true,
          email: true,
          phone: true,
          avatar: true,
          role: true,
          isActive: true,
          twoFactorEnabled: true,
          lockedUntil: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        nickname: true,
        email: true,
        phone: true,
        avatar: true,
        role: true,
        isActive: true,
        twoFactorEnabled: true,
        lockedUntil: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('用户不存在');
    return user;
  }

  async create(dto: CreateUserDto, actorId: string) {
    // 堵提权（G5）：仅 admin 可直建 ADMIN 账号
    if (dto.role === Role.ADMIN) {
      await this.assertAdminActor(actorId);
    }
    this.assertUsernameAllowed(dto.username);
    await this.assertUsernameAvailable(dto.username);
    const email = dto.email ? normalizeEmail(dto.email) : dto.email;
    if (email) await this.assertEmailAvailable(email);
    const phone = dto.phone ? this.normalizePhoneOrThrow(dto.phone) : dto.phone;
    if (phone) await this.assertPhoneAvailable(phone);
    await this.rolesService.assertRoleSlugExists(dto.role);

    const password = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        password,
        nickname: dto.nickname,
        email,
        phone,
        role: dto.role,
      },
      select: {
        id: true,
        username: true,
        nickname: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return user;
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('用户不存在');

    if (dto.username && dto.username !== existing.username) {
      // 白名单仅约束改名（方案 §3.2.1）：回填未变的存量违规用户名（如 seed 超管邮箱形态）放行
      this.assertUsernameAllowed(dto.username);
      await this.assertUsernameAvailable(dto.username);
    }
    let email = dto.email;
    if (dto.email && dto.email !== existing.email) {
      email = normalizeEmail(dto.email);
      await this.assertEmailAvailable(email, id);
    }
    // 格式校验仅在「值相对现库发生变化」时进行，存量非标值（座机/国际号）回填提交放行（方案 §3.4）
    let phone = dto.phone;
    if (dto.phone && dto.phone !== existing.phone) {
      phone = this.normalizePhoneOrThrow(dto.phone);
      await this.assertPhoneAvailable(phone, id);
    }

    const roleChanged = dto.role !== undefined && dto.role !== existing.role;

    // 禁止修改自己的 role（含 admin，防误操作自锁与横向提权，G5）
    if (roleChanged && id === actorId) {
      throw new BadRequestException('不能修改自己的角色，请由另一名管理员操作');
    }

    // 堵提权（G5）：目标为 ADMIN，或将任意用户升为 admin，均需操作者为 admin
    if (existing.role === Role.ADMIN || (roleChanged && dto.role === Role.ADMIN)) {
      await this.assertAdminActor(actorId);
    }

    if (dto.role && dto.role !== existing.role) {
      await this.rolesService.assertRoleSlugExists(dto.role);
    }

    if (dto.isActive === false && id === actorId) {
      throw new BadRequestException('不能停用自己的账号');
    }

    if (dto.role && dto.role !== Role.ADMIN && existing.role === Role.ADMIN) {
      await this.assertNotLastAdmin(id);
    }

    const data: Prisma.UserUpdateInput = {
      username: dto.username,
      nickname: dto.nickname,
      email,
      phone,
      role: dto.role,
      isActive: dto.isActive,
    };

    // 临时锁定：传 ISO 日期字符串锁定，传 null 解锁
    if (dto.lockedUntil !== undefined) {
      data.lockedUntil = dto.lockedUntil === null ? null : new Date(dto.lockedUntil);
    }

    // 改密统一走 reset-password 单一入口（G3）：update 不再读取 password 字段
    //（全局 ValidationPipe whitelist: false，service 不读取才是真正的防线）

    const roleOrActiveChanged =
      (dto.role !== undefined && dto.role !== existing.role) ||
      (dto.isActive !== undefined && dto.isActive !== existing.isActive);

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        nickname: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        twoFactorEnabled: true,
        lockedUntil: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (roleOrActiveChanged) {
      await this.revokeSessions(id);
    }

    return user;
  }

  async remove(id: string, actorId: string) {
    if (id === actorId) {
      throw new BadRequestException('不能删除自己的账号');
    }
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('用户不存在');
    if (existing.role === Role.ADMIN) {
      // 堵提权（G5）：仅 admin 可删除 ADMIN 账号
      await this.assertAdminActor(actorId);
      await this.assertNotLastAdmin(id);
    }
    await this.revokeSessions(id);
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }

  async resetPassword(id: string, dto: ResetUserPasswordDto, actorId: string) {
    if (id === actorId) {
      throw new BadRequestException('不能重置自己的密码，请通过「修改密码」功能操作');
    }

    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('用户不存在');

    // 重置其他管理员密码时：限 admin 操作者（G5，防越权）+ 验证操作者自己的当前密码（防会话劫持）
    if (existing.role === Role.ADMIN) {
      await this.assertAdminActor(actorId);
      if (!dto.actorPassword) {
        throw new BadRequestException('重置管理员密码需要提供您的当前密码');
      }
      const actor = await this.prisma.user.findUnique({ where: { id: actorId } });
      if (!actor) throw new UnauthorizedException();
      const ok = await bcrypt.compare(dto.actorPassword, actor.password);
      if (!ok) {
        throw new UnauthorizedException('您的当前密码不正确');
      }
    }

    // 重置即解锁（G6）：重置密码语义上必然包含「让用户能用新密码登录」
    await this.prisma.user.update({
      where: { id },
      data: {
        password: await bcrypt.hash(dto.password, 12),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await this.revokeSessions(id);
    // 专属语义审计（G4）；与全局 AuditInterceptor 的泛化条目共存，IP/UA/traceId 由后者提供
    await this.audit(actorId, 'user_password_reset', 'users', id);
    return { success: true };
  }

  /**
   * 敏感操作统一 admin 硬校验（G5，防提权）：查库确认操作者 role === 'admin'，
   * 不依赖 controller 装饰器；口径对齐 roles.service 的同名校验（含 isActive）。
   * 见 docs/security/account-recovery-design.md §4.3。
   */
  private async assertAdminActor(actorId: string) {
    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { role: true, isActive: true },
    });
    if (!actor || !actor.isActive || actor.role !== Role.ADMIN) {
      throw new ForbiddenException('仅超级管理员可执行此操作');
    }
  }

  /** 专属语义审计（口径对齐 TwoFactorService.audit）；写入失败不阻断主流程 */
  private async audit(userId: string, action: string, resource: string, resourceId: string) {
    try {
      await this.prisma.auditLog.create({ data: { userId, action, resource, resourceId } });
    } catch (e) {
      this.logger.warn(`审计写入失败: ${(e as Error).message}`);
    }
  }

  private async assertUsernameAvailable(username: string) {
    const found = await this.prisma.user.findUnique({ where: { username } });
    if (found) throw new ConflictException('用户名已存在');
  }

  /**
   * 用户名白名单（防标识碰撞锁户 DoS，方案 §3.2.1）：仅对新建/改名校验，
   * 不放 DTO 层——编辑表单回填存量违规用户名会被 DTO 校验误伤。
   */
  private assertUsernameAllowed(username: string) {
    if (!USERNAME_PATTERN.test(username)) {
      throw new BadRequestException('用户名仅限字母、数字、_ . -，且不能为 11 位手机号形态');
    }
  }

  /** 手机号归一化（去空格/连字符、剥 +86），非大陆手机号形态拒绝（仅对新值/变更值） */
  private normalizePhoneOrThrow(phone: string): string {
    const normalized = normalizePhone(phone);
    if (!normalized) throw new BadRequestException('手机号格式不正确');
    return normalized;
  }

  private async assertEmailAvailable(email: string, excludeId?: string) {
    const found = await this.prisma.user.findFirst({ where: { email } });
    if (found && found.id !== excludeId) {
      throw new ConflictException('邮箱已被使用');
    }
  }

  private async assertPhoneAvailable(phone: string, excludeId?: string) {
    const found = await this.prisma.user.findFirst({ where: { phone } });
    if (found && found.id !== excludeId) {
      throw new ConflictException('手机号已被使用');
    }
  }

  private async assertNotLastAdmin(userId: string) {
    const adminCount = await this.prisma.user.count({
      where: { role: Role.ADMIN, isActive: true, id: { not: userId } },
    });
    if (adminCount < 1) {
      throw new ForbiddenException('系统至少保留一名启用的超级管理员');
    }
  }

  private async revokeSessions(userId: string) {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
