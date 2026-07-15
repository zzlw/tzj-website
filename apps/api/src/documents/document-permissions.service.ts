import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentPermissionDto, DocumentAccessInfo, DocumentPermissionItem, PermissionRole, PermissionTargetType, UpdateDocumentPermissionDto } from './dto/document-permission.dto';

@Injectable()
export class DocumentPermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 检查用户对文档的访问权限
   */
  async checkAccess(
    documentId: string,
    userId: string | undefined,
    canManage: boolean,
  ): Promise<DocumentAccessInfo> {
    const doc = await this.prisma.internalDocument.findUnique({
      where: { id: documentId },
      include: {
        permissions: {
          orderBy: [{ role: 'asc' }, { targetType: 'asc' }, { targetId: 'asc' }],
          include: {
            user: {
              select: {
                username: true,
                nickname: true,
              },
            },
            grantor: {
              select: {
                username: true,
                nickname: true,
              },
            },
          },
        },
      },
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    // 所有者始终拥有完全权限
    if (doc.ownerId === userId || canManage) {
      return {
        canView: true,
        canEdit: true,
        isOwner: true,
        permissions: await this.formatPermissions(doc.permissions),
      };
    }

    // 个人文档：只有所有者和管理员可访问
    if (doc.ownerId) {
      return {
        canView: false,
        canEdit: false,
        isOwner: false,
        permissions: [],
      };
    }

    // 组织文档：检查权限列表
    let canView = false;
    let canEdit = false;

    for (const perm of doc.permissions) {
      if (perm.targetType === PermissionTargetType.PUBLIC) {
        if (perm.role === PermissionRole.VIEWER || perm.role === PermissionRole.EDITOR) {
          canView = true;
        }
        if (perm.role === PermissionRole.EDITOR) {
          canEdit = true;
        }
      } else if (perm.targetType === PermissionTargetType.USER && perm.targetId === userId) {
        if (perm.role === PermissionRole.VIEWER || perm.role === PermissionRole.EDITOR) {
          canView = true;
        }
        if (perm.role === PermissionRole.EDITOR) {
          canEdit = true;
        }
      } else if (perm.targetType === PermissionTargetType.ROLE && userId) {
        // 检查用户是否具有该角色
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });
        if (user?.role === perm.targetId) {
          if (perm.role === PermissionRole.VIEWER || perm.role === PermissionRole.EDITOR) {
            canView = true;
          }
          if (perm.role === PermissionRole.EDITOR) {
            canEdit = true;
          }
        }
      }
    }

    return {
      canView,
      canEdit,
      isOwner: false,
      permissions: await this.formatPermissions(doc.permissions),
    };
  }

  /**
   * 获取文档权限列表（仅所有者或管理员可查看）
   */
  async getPermissions(
    documentId: string,
    userId: string | undefined,
    canManage: boolean,
  ): Promise<DocumentPermissionItem[]> {
    const doc = await this.prisma.internalDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    // 只有所有者或管理员可以查看权限列表
    if (doc.ownerId !== userId && !canManage) {
      throw new ForbiddenException('无权查看权限设置');
    }

    const permissions = await this.prisma.documentPermission.findMany({
      where: { documentId },
      orderBy: [{ role: 'asc' }, { targetType: 'asc' }, { targetId: 'asc' }],
      include: {
        user: {
          select: {
            username: true,
            nickname: true,
          },
        },
        grantor: {
          select: {
            username: true,
            nickname: true,
          },
        },
      },
    });

    return this.formatPermissionsWithNames(permissions);
  }

  /**
   * 更新文档权限（批量替换）
   */
  async updatePermissions(
    documentId: string,
    permissions: CreateDocumentPermissionDto[],
    userId: string | undefined,
    canManage: boolean,
  ): Promise<DocumentPermissionItem[]> {
    const doc = await this.prisma.internalDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    // 只有所有者或管理员可以修改权限
    if (doc.ownerId !== userId && !canManage) {
      throw new ForbiddenException('无权修改权限设置');
    }

    // 验证权限配置
    await this.validatePermissions(permissions, userId, canManage);

    // 删除现有权限并创建新权限
    await this.prisma.documentPermission.deleteMany({
      where: { documentId },
    });

    if (permissions.length > 0) {
      await this.prisma.documentPermission.createMany({
        data: permissions.map((p) => ({
          documentId,
          role: p.role,
          targetType: p.targetType,
          targetId: p.targetId ?? null,
          grantedBy: userId ?? null,
        })),
      });
    }

    // 返回更新后的权限列表
    const updated = await this.prisma.documentPermission.findMany({
      where: { documentId },
      orderBy: [{ role: 'asc' }, { targetType: 'asc' }, { targetId: 'asc' }],
      include: {
        user: {
          select: {
            username: true,
            nickname: true,
          },
        },
        grantor: {
          select: {
            username: true,
            nickname: true,
          },
        },
      },
    });

    return this.formatPermissionsWithNames(updated);
  }

  /**
   * 添加单个权限
   */
  async addPermission(
    documentId: string,
    permission: CreateDocumentPermissionDto,
    userId: string | undefined,
    canManage: boolean,
  ): Promise<DocumentPermissionItem> {
    const doc = await this.prisma.internalDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    if (doc.ownerId !== userId && !canManage) {
      throw new ForbiddenException('无权修改权限设置');
    }

    await this.validatePermissions([permission], userId, canManage);

    // 检查是否已存在相同权限
    const existing = await this.prisma.documentPermission.findFirst({
      where: {
        documentId,
        targetType: permission.targetType,
        targetId: permission.targetId ?? null,
      },
    });

    if (existing) {
      throw new BadRequestException('该权限已存在');
    }

    const created = await this.prisma.documentPermission.create({
      data: {
        documentId,
        role: permission.role,
        targetType: permission.targetType,
        targetId: permission.targetId ?? null,
        grantedBy: userId ?? null,
      },
      include: {
        user: {
          select: {
            username: true,
            nickname: true,
          },
        },
        grantor: {
          select: {
            username: true,
            nickname: true,
          },
        },
      },
    });

    return this.formatPermissionWithName(created);
  }

  /**
   * 删除权限
   */
  async removePermission(
    documentId: string,
    permissionId: string,
    userId: string | undefined,
    canManage: boolean,
  ): Promise<void> {
    const doc = await this.prisma.internalDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    if (doc.ownerId !== userId && !canManage) {
      throw new ForbiddenException('无权修改权限设置');
    }

    const perm = await this.prisma.documentPermission.findUnique({
      where: { id: permissionId },
    });

    if (!perm || perm.documentId !== documentId) {
      throw new NotFoundException('权限不存在');
    }

    await this.prisma.documentPermission.delete({
      where: { id: permissionId },
    });
  }

  /**
   * 验证权限配置
   */
  private async validatePermissions(
    permissions: CreateDocumentPermissionDto[],
    userId: string | undefined,
    canManage: boolean,
  ): Promise<void> {
    // 检查是否有重复的权限目标
    const seen = new Set<string>();
    for (const p of permissions) {
      const key = `${p.targetType}:${p.targetId ?? 'null'}`;
      if (seen.has(key)) {
        throw new BadRequestException(`重复的权限目标: ${key}`);
      }
      seen.add(key);

      // 验证目标是否存在
      if (p.targetType === PermissionTargetType.USER && p.targetId) {
        const user = await this.prisma.user.findUnique({
          where: { id: p.targetId },
        });
        if (!user) {
          throw new BadRequestException(`用户不存在: ${p.targetId}`);
        }
      } else if (p.targetType === PermissionTargetType.ROLE && p.targetId) {
        const role = await this.prisma.accessRole.findUnique({
          where: { slug: p.targetId },
        });
        if (!role) {
          throw new BadRequestException(`角色不存在: ${p.targetId}`);
        }
      }
    }
  }

  /**
   * 格式化权限列表（不含名称）
   */
  private formatPermissions(
    permissions: Array<{
      id: string;
      documentId: string;
      role: string;
      targetType: string;
      targetId: string | null;
      grantedBy: string | null;
      createdAt: Date;
      updatedAt: Date;
      user?: { username: string; nickname: string | null } | null;
      grantor?: { username: string; nickname: string | null } | null;
    }>,
  ): Promise<DocumentPermissionItem[]> {
    return Promise.resolve(this.formatPermissionsWithNames(permissions));
  }

  /**
   * 格式化权限列表（含名称）
   */
  private formatPermissionsWithNames(
    permissions: Array<{
      id: string;
      documentId: string;
      role: string;
      targetType: string;
      targetId: string | null;
      grantedBy: string | null;
      createdAt: Date;
      updatedAt: Date;
      user?: { username: string; nickname: string | null } | null;
      grantor?: { username: string; nickname: string | null } | null;
    }>,
  ): DocumentPermissionItem[] {
    return permissions.map((p) => ({
      id: p.id,
      documentId: p.documentId,
      role: p.role as PermissionRole,
      targetType: p.targetType as PermissionTargetType,
      targetId: p.targetId,
      targetName: p.user
        ? p.user.nickname || p.user.username
        : p.targetType === PermissionTargetType.ROLE
          ? p.targetId
          : p.targetType === PermissionTargetType.PUBLIC
            ? '所有人'
            : null,
      grantedBy: p.grantedBy,
      grantorName: p.grantor?.nickname || p.grantor?.username || null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  }

  /**
   * 格式化单个权限（含名称）
   */
  private formatPermissionWithName(permission: {
    id: string;
    documentId: string;
    role: string;
    targetType: string;
    targetId: string | null;
    grantedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
    user?: { username: string; nickname: string | null } | null;
    grantor?: { username: string; nickname: string | null } | null;
  }): DocumentPermissionItem {
    return {
      id: permission.id,
      documentId: permission.documentId,
      role: permission.role as PermissionRole,
      targetType: permission.targetType as PermissionTargetType,
      targetId: permission.targetId,
      targetName: permission.user
        ? permission.user.nickname || permission.user.username
        : permission.targetType === PermissionTargetType.ROLE
          ? permission.targetId
          : permission.targetType === PermissionTargetType.PUBLIC
            ? '所有人'
            : null,
      grantedBy: permission.grantedBy,
      grantorName: permission.grantor?.nickname || permission.grantor?.username || null,
      createdAt: permission.createdAt.toISOString(),
      updatedAt: permission.updatedAt.toISOString(),
    };
  }
}
