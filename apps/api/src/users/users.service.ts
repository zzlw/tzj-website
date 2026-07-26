import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client/index';
import * as bcrypt from 'bcrypt';
import { RolesService } from '../access/roles.service';
import { Role } from '../auth/roles';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, ResetUserPasswordDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
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

  async create(dto: CreateUserDto) {
    await this.assertUsernameAvailable(dto.username);
    if (dto.email) await this.assertEmailAvailable(dto.email);
    await this.rolesService.assertRoleSlugExists(dto.role);

    const password = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        password,
        nickname: dto.nickname,
        email: dto.email,
        phone: dto.phone,
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
      await this.assertUsernameAvailable(dto.username);
    }
    if (dto.email && dto.email !== existing.email) {
      await this.assertEmailAvailable(dto.email, id);
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
      email: dto.email,
      phone: dto.phone,
      role: dto.role,
      isActive: dto.isActive,
    };

    // 临时锁定：传 ISO 日期字符串锁定，传 null 解锁
    if (dto.lockedUntil !== undefined) {
      data.lockedUntil = dto.lockedUntil === null ? null : new Date(dto.lockedUntil);
    }

    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 12);
      await this.revokeSessions(id);
    }

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

    // 重置其他管理员密码时，需要验证操作者自己的当前密码
    if (existing.role === Role.ADMIN) {
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

    await this.prisma.user.update({
      where: { id },
      data: { password: await bcrypt.hash(dto.password, 12) },
    });
    await this.revokeSessions(id);
    return { success: true };
  }

  private async assertUsernameAvailable(username: string) {
    const found = await this.prisma.user.findUnique({ where: { username } });
    if (found) throw new ConflictException('用户名已存在');
  }

  private async assertEmailAvailable(email: string, excludeId?: string) {
    const found = await this.prisma.user.findFirst({ where: { email } });
    if (found && found.id !== excludeId) {
      throw new ConflictException('邮箱已被使用');
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
