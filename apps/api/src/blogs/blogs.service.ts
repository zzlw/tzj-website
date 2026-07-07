import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client/index";
import { CreateBlogDto, UpdateBlogDto } from "./dto/blog.dto";
import { ContentStatus } from "../common/enums/content-status.enum";
import { sanitizeMarkdown } from "../common/utils/markdown";
import { estimateReadTime } from "../common/utils/read-time";
import { generateDocumentSummary } from "../common/utils/document-summary";
import {
  applyPublishedFilter,
  assertPublishedOrStaff,
} from "../common/utils/content-query";
import { resolveContentAuthor } from "../common/utils/content-author";
import { applyContentEditorMetadata } from "../common/utils/content-metadata";
import {
  CONTENT_ADMIN_USER_INCLUDE,
  stripInternalContentFields,
} from "../common/utils/content-list";
import {
  buildListOrderBy,
  DEFAULT_CONTENT_LIST_ORDER,
  parseListSort,
} from "../common/utils/list-sort";

const LIST_SORT_FIELDS = [
  "title",
  "category",
  "status",
  "publishedAt",
  "createdAt",
  "updatedAt",
  "createdById",
  "lastOperatorId",
] as const;

interface FindAllParams {
  page: number;
  limit: number;
  category?: string;
  search?: string;
  includeUnpublished?: boolean;
  sortBy?: string;
  sortOrder?: string;
}

@Injectable()
export class BlogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: FindAllParams) {
    const {
      page,
      limit,
      category,
      search,
      includeUnpublished = false,
      sortBy,
      sortOrder,
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.BlogWhereInput = {
      ...applyPublishedFilter(includeUnpublished),
    };
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { excerpt: { contains: search, mode: "insensitive" } },
      ];
    }

    const sort = parseListSort(sortBy, sortOrder, LIST_SORT_FIELDS);
    const orderBy = buildListOrderBy(sort, DEFAULT_CONTENT_LIST_ORDER.blogs);

    const [rawData, total] = await Promise.all([
      includeUnpublished
        ? this.prisma.blog.findMany({
            where,
            skip,
            take: limit,
            orderBy,
            include: CONTENT_ADMIN_USER_INCLUDE,
          })
        : this.prisma.blog.findMany({
            where,
            skip,
            take: limit,
            orderBy,
          }),
      this.prisma.blog.count({ where }),
    ]);

    return {
      data: rawData.map((item) =>
        stripInternalContentFields(item, includeUnpublished),
      ),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(idOrSlug: string, includeUnpublished = false) {
    const item = await this.prisma.blog.findFirst({
      where: { OR: [{ slug: idOrSlug }, { id: idOrSlug }] },
    });
    if (!item) throw new NotFoundException(`博客 "${idOrSlug}" 未找到`);
    assertPublishedOrStaff(item.status, includeUnpublished);

    // 后台预览（已鉴权）不计入浏览量
    if (!includeUnpublished) {
      await this.prisma.blog.update({
        where: { id: item.id },
        data: { viewCount: { increment: 1 } },
      });
    }

    return item;
  }

  async create(dto: CreateBlogDto, editorId?: string) {
    const { readTime: _ignored, author: _author, excerpt, ...rest } = dto;
    const data: Prisma.BlogCreateInput = { ...rest };
    if (dto.content !== undefined) {
      data.content = sanitizeMarkdown(dto.content);
    }
    // 如果未提供简介，则根据正文自动生成
    if (excerpt === undefined && dto.content !== undefined) {
      data.excerpt = generateDocumentSummary(data.content as string | null | undefined);
    } else if (excerpt !== undefined) {
      data.excerpt = excerpt;
    }
    data.readTime = estimateReadTime(data.content, data.excerpt);
    if (dto.status === ContentStatus.PUBLISHED && !dto.publishedAt) {
      data.publishedAt = new Date();
    }
    if (editorId) {
      data.author = await resolveContentAuthor(this.prisma, editorId);
    }
    Object.assign(
      data,
      await applyContentEditorMetadata(this.prisma, editorId, dto.status),
    );
    return this.prisma.blog.create({ data });
  }

  async update(id: string, dto: UpdateBlogDto, editorId?: string) {
    const item = await this.prisma.blog.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`博客 ID "${id}" 未找到`);

    const { readTime: _ignored, author: _author, excerpt, ...rest } = dto;
    const data: Prisma.BlogUpdateInput = { ...rest };
    if (dto.content !== undefined) {
      data.content = sanitizeMarkdown(dto.content);
    }
    // 如果提供了新简介，使用它；否则如果正文被更新，重新生成简介
    if (excerpt !== undefined) {
      data.excerpt = excerpt;
    } else if (dto.content !== undefined) {
      const contentToUse = data.content as string | null | undefined;
      data.excerpt = generateDocumentSummary(contentToUse);
    }
    // 更新阅读时长（基于最新的正文和简介）
    if (dto.content !== undefined || dto.excerpt !== undefined) {
      const content =
        dto.content !== undefined
          ? (data.content as string | null)
          : item.content;
      const finalExcerpt =
        dto.excerpt !== undefined
          ? dto.excerpt
          : (data.excerpt as string | null | undefined) ?? item.excerpt;
      data.readTime = estimateReadTime(content, finalExcerpt);
    }
    if (
      dto.status === ContentStatus.PUBLISHED &&
      !dto.publishedAt &&
      !item.publishedAt
    ) {
      data.publishedAt = new Date();
    }
    if (editorId) {
      data.author = await resolveContentAuthor(this.prisma, editorId);
    }
    Object.assign(
      data,
      await applyContentEditorMetadata(
        this.prisma,
        editorId,
        dto.status ?? item.status,
        item,
      ),
    );
    return this.prisma.blog.update({ where: { id }, data });
  }

  async remove(id: string) {
    const item = await this.prisma.blog.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`博客 ID "${id}" 未找到`);
    await this.prisma.blog.delete({ where: { id } });
    return { deleted: true };
  }
}
