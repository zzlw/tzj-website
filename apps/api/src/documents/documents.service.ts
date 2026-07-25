import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client/index';
import { ContentStatus } from '../common/enums/content-status.enum';
import {
  CONTENT_ADMIN_USER_INCLUDE,
  stripInternalContentFields,
} from '../common/utils/content-list';
import { applyContentEditorMetadata } from '../common/utils/content-metadata';
import { generateDocumentSummary } from '../common/utils/document-summary';
import { buildListOrderBy, type OrderByEntry, parseListSort } from '../common/utils/list-sort';
import { sanitizeMarkdown } from '../common/utils/markdown';
import { ensureUniqueDocumentSlug, slugifyTitle } from '../common/utils/slug';
import { PrismaService } from '../prisma/prisma.service';
import { DocTagsService } from './doc-tags.service';
import { DocumentPermissionsService } from './document-permissions.service';
import type { CreateDocumentDto, UpdateDocumentDto } from './dto/document.dto';

const LIST_SORT_FIELDS = [
  'title',
  'status',
  'publishedAt',
  'createdAt',
  'updatedAt',
  'viewCount',
  'isPinned',
  'sortOrder',
  'createdById',
  'lastOperatorId',
] as const;

const DEFAULT_ORDER: OrderByEntry[] = [
  { isPinned: 'desc' },
  { sortOrder: 'asc' },
  { updatedAt: 'desc' },
];

/**
 * 计算文档的可见范围
 * - private: 仅自己可见（有 ownerId 且无 public 权限）
 * - partial: 部分人可见（有特定用户/角色权限但无 public）
 * - public: 全局可见（有 public 权限）
 */
function calculateVisibility(
  ownerId: string | null,
  permissions: Array<{ targetType: string; role: string }> = [],
): 'private' | 'partial' | 'public' {
  // 如果有 public 权限，则是全局可见
  const hasPublic = permissions.some((p) => p.targetType === 'public');
  if (hasPublic) return 'public';

  // 如果是个人文档（有 ownerId），且没有其他权限配置，则仅自己可见
  if (ownerId && permissions.length === 0) return 'private';

  // 如果有任何用户或角色权限，则是部分人可见
  if (permissions.length > 0) return 'partial';

  // 默认情况：组织文档无权限配置，视为私有
  return 'private';
}

interface FindAllParams {
  page: number;
  limit: number;
  folderId?: string;
  tag?: string;
  search?: string;
  /** published | draft；省略且 includeDrafts 时返回全部状态 */
  status?: string;
  includeDrafts?: boolean;
  mine?: boolean;
  userId?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface FindOneOptions {
  includeDrafts?: boolean;
  viewerId?: string;
  canManage?: boolean;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly docTagsService: DocTagsService,
    private readonly permissionsService: DocumentPermissionsService,
  ) {}

  private assertDocumentAccess(
    item: { ownerId: string | null },
    viewerId: string | undefined,
    canManage: boolean,
  ) {
    if (item.ownerId && item.ownerId !== viewerId && !canManage) {
      throw new NotFoundException('文档不存在');
    }
  }

  private async assertFolderScope(
    folderId: string | null | undefined,
    personal: boolean,
    userId: string,
  ) {
    if (!folderId) return;
    const folder = await this.prisma.docFolder.findUnique({
      where: { id: folderId },
    });
    if (!folder) throw new NotFoundException('文件夹不存在');
    if (personal) {
      if (folder.ownerId !== userId) {
        throw new BadRequestException('个人文档只能放入个人文件夹');
      }
    } else if (folder.ownerId !== null) {
      throw new BadRequestException('内部文档只能放入组织文件夹');
    }
  }

  /** 从正文自动生成摘要；无正文时返回 null。 */
  private resolveSummary(content: string | null | undefined): string | null {
    return generateDocumentSummary(content);
  }

  /** 为历史文档补全缺失摘要（惰性回填，便于搜索与列表展示）。 */
  private async backfillMissingSummaries<
    T extends { id: string; summary: string | null; content: string | null },
  >(items: T[]): Promise<void> {
    const pending = items.filter((item) => !item.summary?.trim() && item.content?.trim());
    if (!pending.length) return;

    await Promise.all(
      pending.map(async (item) => {
        const summary = generateDocumentSummary(item.content);
        if (!summary) return;
        await this.prisma.internalDocument.update({
          where: { id: item.id },
          data: { summary },
        });
        item.summary = summary;
      }),
    );
  }

  private async applyDocumentEditorMetadata(
    editorId: string | undefined,
    nextStatus: string | undefined,
    existing?: { status?: string; publishedAt?: Date | null } | null,
  ): Promise<
    Pick<
      Prisma.InternalDocumentUncheckedUpdateInput,
      'createdById' | 'createdBy' | 'lastOperatorId' | 'lastOperator'
    >
  > {
    const patch = await applyContentEditorMetadata(
      this.prisma,
      editorId,
      nextStatus,
      existing
        ? {
            status: existing.status,
            systemPublishedAt: existing.publishedAt,
          }
        : null,
    );
    return {
      ...(patch.createdById != null && { createdById: patch.createdById }),
      ...(patch.createdBy != null && { createdBy: patch.createdBy }),
      ...(patch.lastOperatorId != null && { lastOperatorId: patch.lastOperatorId }),
      ...(patch.lastOperator != null && { lastOperator: patch.lastOperator }),
    };
  }

  async findAll(params: FindAllParams) {
    const {
      page,
      limit,
      folderId,
      tag,
      search,
      status,
      includeDrafts = false,
      mine = false,
      userId,
      sortBy,
      sortOrder,
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.InternalDocumentWhereInput = {};
    const andFilters: Prisma.InternalDocumentWhereInput[] = [];

    if (mine && userId) {
      where.ownerId = userId;
    } else {
      where.ownerId = null;
      if (!includeDrafts) {
        where.status = ContentStatus.PUBLISHED;
      } else if (status === ContentStatus.PUBLISHED || status === 'published') {
        where.status = ContentStatus.PUBLISHED;
      } else if (status === ContentStatus.DRAFT || status === 'draft') {
        where.status = ContentStatus.DRAFT;
      }
    }

    if (folderId === '__none__') {
      where.folderId = null;
    } else if (folderId) {
      where.folderId = folderId;
    }
    if (tag) {
      where.tags = { has: tag };
    }
    if (search?.trim()) {
      const q = search.trim();
      // 全字段检索（业内知识库惯例：Notion/Confluence 搜标题+正文+标签+所属目录）：
      // 标题/摘要/正文模糊匹配，标签精确命中，文件夹名模糊匹配（搜目录名可定位整类文档）。
      andFilters.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { summary: { contains: q, mode: 'insensitive' } },
          { content: { contains: q, mode: 'insensitive' } },
          { tags: { has: q } },
          { folder: { is: { name: { contains: q, mode: 'insensitive' } } } },
        ],
      });
    }

    if (andFilters.length) {
      where.AND = andFilters;
    }

    const sort = parseListSort(sortBy, sortOrder, LIST_SORT_FIELDS);
    const orderBy = buildListOrderBy(sort, DEFAULT_ORDER);
    const richInclude = includeDrafts || (mine && Boolean(userId));

    // 构建 include 对象，添加 permissions
    const baseInclude = richInclude ? CONTENT_ADMIN_USER_INCLUDE : { folder: true };
    const includeWithPermissions = {
      ...baseInclude,
      permissions: {
        select: {
          targetType: true,
          role: true,
        },
      },
    };

    const [rawData, total] = await Promise.all([
      this.prisma.internalDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: includeWithPermissions,
      }),
      this.prisma.internalDocument.count({ where }),
    ]);

    if (richInclude) {
      await this.backfillMissingSummaries(rawData);
    }

    return {
      data: rawData.map((item) => {
        const strippedItem = richInclude
          ? stripInternalContentFields(item, true)
          : { ...item, content: undefined };

        // 计算可见范围
        const visibility = calculateVisibility(item.ownerId ?? null, item.permissions ?? []);

        return {
          ...strippedItem,
          visibility,
        };
      }),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(idOrSlug: string, options: FindOneOptions = {}) {
    const { includeDrafts = false, viewerId, canManage = false } = options;
    const item = await this.prisma.internalDocument.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: {
        ...CONTENT_ADMIN_USER_INCLUDE,
        folder: true,
      },
    });
    if (!item) throw new NotFoundException(`文档 "${idOrSlug}" 未找到`);

    // 使用权限服务检查访问权限
    const accessInfo = await this.permissionsService.checkAccess(item.id, viewerId, canManage);

    // 个人文档：只有所有者和管理员可访问
    const isPersonal = Boolean(item.ownerId);
    if (isPersonal && !accessInfo.canView) {
      throw new NotFoundException(`文档 "${idOrSlug}" 未找到`);
    }

    // 组织文档：根据状态和权限检查
    if (!isPersonal) {
      const canSeeDraft = accessInfo.canEdit || includeDrafts;
      if (!canSeeDraft && item.status !== ContentStatus.PUBLISHED) {
        throw new NotFoundException(`文档 "${idOrSlug}" 未找到`);
      }
    }

    const draftPreview =
      item.status !== ContentStatus.PUBLISHED &&
      (isPersonal ? item.ownerId === viewerId || canManage : includeDrafts);
    if (item.status === ContentStatus.PUBLISHED && !draftPreview) {
      await this.prisma.internalDocument.update({
        where: { id: item.id },
        data: { viewCount: { increment: 1 } },
      });
    }

    await this.backfillMissingSummaries([item]);

    return item;
  }

  async create(dto: CreateDocumentDto, editorId?: string) {
    const personal = Boolean(dto.personal);
    if (personal && !editorId) {
      throw new BadRequestException('个人文档需要登录用户');
    }

    const title = dto.title.trim();
    const baseSlug = dto.slug?.trim() || slugifyTitle(title);
    const slug = await ensureUniqueDocumentSlug(this.prisma, baseSlug);

    if (editorId) {
      await this.assertFolderScope(dto.folderId ?? null, personal, editorId);
    }

    const content = dto.content !== undefined ? sanitizeMarkdown(dto.content) : null;

    const data: Prisma.InternalDocumentUncheckedCreateInput = {
      title,
      slug,
      summary: this.resolveSummary(content),
      content,
      status: dto.status ?? ContentStatus.DRAFT,
      tags: dto.tags ?? [],
      isPinned: dto.isPinned ?? false,
      folderId: dto.folderId ?? null,
      ownerId: personal ? editorId! : null,
    };

    if (dto.status === ContentStatus.PUBLISHED && !dto.publishedAt) {
      data.publishedAt = new Date();
    } else if (dto.publishedAt) {
      data.publishedAt = new Date(dto.publishedAt);
    }

    if (editorId) {
      Object.assign(data, await this.applyDocumentEditorMetadata(editorId, data.status as string));
    }

    const created = await this.prisma.internalDocument.create({ data });

    const tagList = dto.tags ?? [];
    if (tagList.length) {
      await this.docTagsService.ensureTags(
        tagList,
        {
          mine: personal,
          userId: editorId,
          includeDrafts: true,
        },
        editorId,
      );
    }

    return created;
  }

  async update(id: string, dto: UpdateDocumentDto, editorId?: string, canManage = false) {
    const item = await this.prisma.internalDocument.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`文档 ID "${id}" 未找到`);

    // 使用权限服务检查编辑权限
    const accessInfo = await this.permissionsService.checkAccess(id, editorId, canManage);
    if (!accessInfo.canEdit) {
      throw new ForbiddenException('无权编辑此文档');
    }

    const contentChanged = dto.content !== undefined && dto.content !== item.content;
    const titleChanged = dto.title !== undefined && dto.title !== item.title;
    if (contentChanged || titleChanged) {
      await this.prisma.internalDocumentRevision.create({
        data: {
          documentId: item.id,
          title: item.title,
          content: item.content,
          editorId: editorId ?? null,
        },
      });
    }

    const data: Prisma.InternalDocumentUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.slug !== undefined) {
      const base = dto.slug.trim() || slugifyTitle(dto.title ?? item.title);
      data.slug = await ensureUniqueDocumentSlug(this.prisma, base, id);
    }
    if (dto.content !== undefined) {
      data.content = sanitizeMarkdown(dto.content);
      data.summary = this.resolveSummary(data.content as string);
    }
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.isPinned !== undefined) data.isPinned = dto.isPinned;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.folderId !== undefined) {
      if (editorId) {
        await this.assertFolderScope(dto.folderId, Boolean(item.ownerId), editorId);
      }
      data.folderId = dto.folderId;
    }

    const nextStatus = dto.status ?? item.status;
    if (dto.status === ContentStatus.PUBLISHED && !dto.publishedAt && !item.publishedAt) {
      data.publishedAt = new Date();
    } else if (dto.publishedAt) {
      data.publishedAt = new Date(dto.publishedAt);
    }

    if (editorId) {
      Object.assign(data, await this.applyDocumentEditorMetadata(editorId, nextStatus, item));
    }

    const updated = await this.prisma.internalDocument.update({
      where: { id },
      data,
      include: CONTENT_ADMIN_USER_INCLUDE,
    });

    const tagList = dto.tags !== undefined ? (dto.tags ?? []) : (item.tags ?? []);
    if (tagList.length || dto.tags !== undefined) {
      await this.docTagsService.ensureTags(
        tagList,
        {
          mine: Boolean(item.ownerId),
          userId: item.ownerId ?? editorId,
          includeDrafts: true,
        },
        editorId,
      );
    }

    return updated;
  }

  async remove(id: string, viewerId?: string, canManage = false) {
    const item = await this.prisma.internalDocument.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`文档 ID "${id}" 未找到`);

    // 使用权限服务检查删除权限（需要编辑权限）
    const accessInfo = await this.permissionsService.checkAccess(id, viewerId, canManage);
    if (!accessInfo.canEdit) {
      throw new ForbiddenException('无权删除此文档');
    }

    await this.prisma.internalDocument.delete({ where: { id } });
    return { deleted: true };
  }

  async listRevisions(documentId: string, viewerId?: string, canManage = false) {
    const doc = await this.prisma.internalDocument.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundException('文档不存在');
    this.assertDocumentAccess(doc, viewerId, canManage);

    const rows = await this.prisma.internalDocumentRevision.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        editor: {
          select: {
            id: true,
            username: true,
            nickname: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      editor: row.editor
        ? { id: row.editor.id, username: row.editor.username, nickname: row.editor.nickname }
        : null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async restoreRevision(
    documentId: string,
    revisionId: string,
    editorId?: string,
    canManage = false,
  ) {
    const doc = await this.prisma.internalDocument.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundException('文档不存在');
    this.assertDocumentAccess(doc, editorId, canManage);

    const revision = await this.prisma.internalDocumentRevision.findFirst({
      where: { id: revisionId, documentId },
    });
    if (!revision) throw new NotFoundException('版本不存在');

    return this.update(
      documentId,
      { title: revision.title, content: revision.content ?? '' },
      editorId,
      canManage,
    );
  }

  /** 文档中心 — 重排某文件夹（folderId 省略/null = 未分类）内个人文档的顺序 */
  async reorderDocuments(
    userId: string,
    { folderId, orderedIds }: { folderId?: string | null; orderedIds: string[] },
  ) {
    const targetFolderId = folderId ?? null;
    if (!orderedIds.length) return { reordered: 0 };

    // 仅允许操作本人个人文档，且必须位于目标文件夹内
    const docs = await this.prisma.internalDocument.findMany({
      where: { id: { in: orderedIds }, ownerId: userId, folderId: targetFolderId },
      select: { id: true },
    });
    const allowed = new Set(docs.map((d) => d.id));
    const ids = orderedIds.filter((id) => allowed.has(id));

    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.internalDocument.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    return { reordered: ids.length };
  }

  /** 文档中心 — 移动个人文档到目标文件夹并落到指定序位（省略则置末尾） */
  async moveDocument(
    userId: string,
    id: string,
    { folderId, sortOrder }: { folderId?: string | null; sortOrder?: number },
  ) {
    const doc = await this.prisma.internalDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException(`文档 ID "${id}" 未找到`);
    if (doc.ownerId !== userId) {
      throw new ForbiddenException('无权移动此文档');
    }

    const targetFolderId = folderId ?? null;
    await this.assertFolderScope(targetFolderId, true, userId);

    let order = sortOrder;
    if (order === undefined || order < 0) {
      const last = await this.prisma.internalDocument.aggregate({
        where: { ownerId: userId, folderId: targetFolderId },
        _max: { sortOrder: true },
      });
      order = (last._max.sortOrder ?? -1) + 1;
    }

    return this.prisma.internalDocument.update({
      where: { id },
      data: { folderId: targetFolderId, sortOrder: order },
    });
  }

  // ==================== 权限管理方法 ====================

  /**
   * 获取文档权限列表
   */
  async getPermissions(documentId: string, userId: string | undefined, canManage: boolean) {
    return this.permissionsService.getPermissions(documentId, userId, canManage);
  }

  /**
   * 更新文档权限（批量替换）
   */
  async updatePermissions(
    documentId: string,
    permissions: any[],
    userId: string | undefined,
    canManage: boolean,
  ) {
    return this.permissionsService.updatePermissions(documentId, permissions, userId, canManage);
  }

  /**
   * 添加单个权限
   */
  async addPermission(
    documentId: string,
    permission: any,
    userId: string | undefined,
    canManage: boolean,
  ) {
    return this.permissionsService.addPermission(documentId, permission, userId, canManage);
  }

  /**
   * 删除权限
   */
  async removePermission(
    documentId: string,
    permissionId: string,
    userId: string | undefined,
    canManage: boolean,
  ) {
    return this.permissionsService.removePermission(documentId, permissionId, userId, canManage);
  }
}
