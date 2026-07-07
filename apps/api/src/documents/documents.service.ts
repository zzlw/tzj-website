import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client/index";
import { PrismaService } from "../prisma/prisma.service";
import { ContentStatus } from "../common/enums/content-status.enum";
import { sanitizeMarkdown } from "../common/utils/markdown";
import { applyContentEditorMetadata } from "../common/utils/content-metadata";
import {
  CONTENT_ADMIN_USER_INCLUDE,
  stripInternalContentFields,
} from "../common/utils/content-list";
import {
  buildListOrderBy,
  parseListSort,
  type OrderByEntry,
} from "../common/utils/list-sort";
import { CreateDocumentDto, UpdateDocumentDto } from "./dto/document.dto";
import {
  ensureUniqueDocumentSlug,
  slugifyTitle,
} from "../common/utils/slug";
import { DocTagsService } from "./doc-tags.service";
import { generateDocumentSummary } from "../common/utils/document-summary";

const LIST_SORT_FIELDS = [
  "title",
  "status",
  "publishedAt",
  "createdAt",
  "updatedAt",
  "viewCount",
  "isPinned",
  "createdById",
  "lastOperatorId",
] as const;

const DEFAULT_ORDER: OrderByEntry[] = [
  { isPinned: "desc" },
  { updatedAt: "desc" },
];

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
  ) {}

  private assertDocumentAccess(
    item: { ownerId: string | null },
    viewerId: string | undefined,
    canManage: boolean,
  ) {
    if (item.ownerId && item.ownerId !== viewerId && !canManage) {
      throw new NotFoundException("文档不存在");
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
    if (!folder) throw new NotFoundException("文件夹不存在");
    if (personal) {
      if (folder.ownerId !== userId) {
        throw new BadRequestException("个人文档只能放入个人文件夹");
      }
    } else if (folder.ownerId !== null) {
      throw new BadRequestException("内部文档只能放入组织文件夹");
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
    const pending = items.filter(
      (item) => !item.summary?.trim() && item.content?.trim(),
    );
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
      "createdById" | "createdBy" | "lastOperatorId" | "lastOperator"
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
      } else if (status === ContentStatus.PUBLISHED || status === "published") {
        where.status = ContentStatus.PUBLISHED;
      } else if (status === ContentStatus.DRAFT || status === "draft") {
        where.status = ContentStatus.DRAFT;
      }
    }

    if (folderId === "__none__") {
      where.folderId = null;
    } else if (folderId) {
      where.folderId = folderId;
    }
    if (tag) {
      where.tags = { has: tag };
    }
    if (search?.trim()) {
      const q = search.trim();
      andFilters.push({
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { summary: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    if (andFilters.length) {
      where.AND = andFilters;
    }

    const sort = parseListSort(sortBy, sortOrder, LIST_SORT_FIELDS);
    const orderBy = buildListOrderBy(sort, DEFAULT_ORDER);
    const richInclude = includeDrafts || (mine && Boolean(userId));

    const [rawData, total] = await Promise.all([
      this.prisma.internalDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: richInclude ? CONTENT_ADMIN_USER_INCLUDE : { folder: true },
      }),
      this.prisma.internalDocument.count({ where }),
    ]);

    if (richInclude) {
      await this.backfillMissingSummaries(rawData);
    }

    return {
      data: rawData.map((item) =>
        richInclude
          ? stripInternalContentFields(item, true)
          : { ...item, content: undefined },
      ),
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

    const isPersonal = Boolean(item.ownerId);
    if (isPersonal) {
      this.assertDocumentAccess(item, viewerId, canManage);
      const canSeeDraft =
        item.ownerId === viewerId || canManage;
      if (!canSeeDraft && item.status !== ContentStatus.PUBLISHED) {
        throw new NotFoundException(`文档 "${idOrSlug}" 未找到`);
      }
    } else if (!includeDrafts && item.status !== ContentStatus.PUBLISHED) {
      throw new NotFoundException(`文档 "${idOrSlug}" 未找到`);
    }

    const draftPreview =
      item.status !== ContentStatus.PUBLISHED &&
      (isPersonal
        ? item.ownerId === viewerId || canManage
        : includeDrafts);
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
      throw new BadRequestException("个人文档需要登录用户");
    }

    const title = dto.title.trim();
    const baseSlug = dto.slug?.trim() || slugifyTitle(title);
    const slug = await ensureUniqueDocumentSlug(this.prisma, baseSlug);

    if (editorId) {
      await this.assertFolderScope(dto.folderId ?? null, personal, editorId);
    }

    const content =
      dto.content !== undefined ? sanitizeMarkdown(dto.content) : null;

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
      Object.assign(
        data,
        await this.applyDocumentEditorMetadata(
          editorId,
          data.status as string,
        ),
      );
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

  async update(
    id: string,
    dto: UpdateDocumentDto,
    editorId?: string,
    canManage = false,
  ) {
    const item = await this.prisma.internalDocument.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`文档 ID "${id}" 未找到`);
    this.assertDocumentAccess(item, editorId, canManage);

    const contentChanged =
      dto.content !== undefined && dto.content !== item.content;
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
        await this.assertFolderScope(
          dto.folderId,
          Boolean(item.ownerId),
          editorId,
        );
      }
      data.folderId = dto.folderId;
    }

    const nextStatus = dto.status ?? item.status;
    if (
      dto.status === ContentStatus.PUBLISHED &&
      !dto.publishedAt &&
      !item.publishedAt
    ) {
      data.publishedAt = new Date();
    } else if (dto.publishedAt) {
      data.publishedAt = new Date(dto.publishedAt);
    }

    if (editorId) {
      Object.assign(
        data,
        await this.applyDocumentEditorMetadata(editorId, nextStatus, item),
      );
    }

    const updated = await this.prisma.internalDocument.update({
      where: { id },
      data,
      include: CONTENT_ADMIN_USER_INCLUDE,
    });

    const tagList =
      dto.tags !== undefined ? (dto.tags ?? []) : (item.tags ?? []);
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
    this.assertDocumentAccess(item, viewerId, canManage);
    await this.prisma.internalDocument.delete({ where: { id } });
    return { deleted: true };
  }

  async listRevisions(
    documentId: string,
    viewerId?: string,
    canManage = false,
  ) {
    const doc = await this.prisma.internalDocument.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundException("文档不存在");
    this.assertDocumentAccess(doc, viewerId, canManage);

    const rows = await this.prisma.internalDocumentRevision.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
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
    if (!doc) throw new NotFoundException("文档不存在");
    this.assertDocumentAccess(doc, editorId, canManage);

    const revision = await this.prisma.internalDocumentRevision.findFirst({
      where: { id: revisionId, documentId },
    });
    if (!revision) throw new NotFoundException("版本不存在");

    return this.update(
      documentId,
      { title: revision.title, content: revision.content ?? "" },
      editorId,
      canManage,
    );
  }

}
