import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { Prisma } from "@prisma/client/index";
import { PrismaService } from "../prisma/prisma.service";
import { Role } from "../auth/roles";
import {
  CreateUserDto,
  ResetUserPasswordDto,
  UpdateUserDto,
} from "./dto/user.dto";
import { RolesService } from "../access/roles.service";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rolesService: RolesService,
  ) {}

  async findAll(params: {
    page: number;
    limit: number;
    search?: string;
    role?: string;
  }) {
    const { page, limit, search, role } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { username: { contains: search, mode: "insensitive" } },
        { nickname: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          username: true,
          nickname: true,
          email: true,
          phone: true,
          avatar: true,
          role: true,
          isActive: true,
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
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException("用户不存在");
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
    if (!existing) throw new NotFoundException("用户不存在");

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
      throw new BadRequestException("不能停用自己的账号");
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
      throw new BadRequestException("不能删除自己的账号");
    }
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("用户不存在");
    if (existing.role === Role.ADMIN) {
      await this.assertNotLastAdmin(id);
    }
    await this.revokeSessions(id);
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }

  async resetPassword(id: string, dto: ResetUserPasswordDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("用户不存在");

    await this.prisma.user.update({
      where: { id },
      data: { password: await bcrypt.hash(dto.password, 12) },
    });
    await this.revokeSessions(id);
    return { success: true };
  }

  private async assertUsernameAvailable(username: string) {
    const found = await this.prisma.user.findUnique({ where: { username } });
    if (found) throw new ConflictException("用户名已存在");
  }

  private async assertEmailAvailable(email: string, excludeId?: string) {
    const found = await this.prisma.user.findFirst({ where: { email } });
    if (found && found.id !== excludeId) {
      throw new ConflictException("邮箱已被使用");
    }
  }

  private async assertNotLastAdmin(userId: string) {
    const adminCount = await this.prisma.user.count({
      where: { role: Role.ADMIN, isActive: true, id: { not: userId } },
    });
    if (adminCount < 1) {
      throw new ForbiddenException("系统至少保留一名启用的超级管理员");
    }
  }

  private async revokeSessions(userId: string) {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
