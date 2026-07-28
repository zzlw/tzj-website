import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client/index';
import { ContentStatus } from '../common/enums/content-status.enum';
import { resolveContentAuthor } from '../common/utils/content-author';
import {
  CONTENT_ADMIN_USER_INCLUDE,
  stripInternalContentFields,
} from '../common/utils/content-list';
import { applyContentEditorMetadata } from '../common/utils/content-metadata';
import { applyPublishedFilter, assertPublishedOrStaff } from '../common/utils/content-query';
import { generateDocumentSummary } from '../common/utils/document-summary';
import {
  buildListOrderBy,
  DEFAULT_CONTENT_LIST_ORDER,
  parseListSort,
} from '../common/utils/list-sort';
import { sanitizeMarkdown } from '../common/utils/markdown';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNewsDto, UpdateNewsDto } from './dto/news.dto';

const LIST_SORT_FIELDS = [
  'title',
  'category',
  'status',
  'publishedAt',
  'createdAt',
  'updatedAt',
  'createdById',
  'lastOperatorId',
] as const;

interface FindAllParams {
  page: number;
  limit: number;
  category?: string;
  status?: string;
  search?: string;
  includeUnpublished?: boolean;
  sortBy?: string;
  sortOrder?: string;
}

@Injectable()
export class NewsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: FindAllParams) {
    const {
      page,
      limit,
      category,
      status,
      search,
      includeUnpublished = false,
      sortBy,
      sortOrder,
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.NewsWhereInput = {
      ...applyPublishedFilter(includeUnpublished),
    };
    // 后台（已登录）可按具体发布状态过滤；公开访问恒为「仅已发布」，忽略该参数以防越权查看草稿/归档。
    if (status && includeUnpublished) where.status = status;
    if (category) where.category = category;
    if (search) {
      // OR 模糊匹配业务关键文本字段（标题/摘要/正文/作者），覆盖后台常用检索维度。
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
      ];
    }

    const sort = parseListSort(sortBy, sortOrder, LIST_SORT_FIELDS);
    const orderBy = buildListOrderBy(sort, DEFAULT_CONTENT_LIST_ORDER.news);

    const [rawData, total] = await Promise.all([
      includeUnpublished
        ? this.prisma.news.findMany({
            where,
            skip,
            take: limit,
            orderBy,
            include: CONTENT_ADMIN_USER_INCLUDE,
          })
        : this.prisma.news.findMany({
            where,
            skip,
            take: limit,
            orderBy,
          }),
      this.prisma.news.count({ where }),
    ]);

    return {
      data: rawData.map((item) => stripInternalContentFields(item, includeUnpublished)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(idOrSlug: string, includeUnpublished = false) {
    const item = await this.prisma.news.findFirst({
      where: { OR: [{ slug: idOrSlug }, { id: idOrSlug }] },
    });
    if (!item) throw new NotFoundException(`新闻 "${idOrSlug}" 未找到`);
    assertPublishedOrStaff(item.status, includeUnpublished);

    // 后台预览（已鉴权）不计入浏览量
    if (!includeUnpublished) {
      await this.prisma.news.update({
        where: { id: item.id },
        data: { viewCount: { increment: 1 } },
      });
    }

    return item;
  }

  async create(dto: CreateNewsDto, editorId?: string) {
    const { author: _author, summary, ...rest } = dto;
    const data: Prisma.NewsCreateInput = { ...rest };
    if (dto.content !== undefined) {
      data.content = sanitizeMarkdown(dto.content);
    }
    // 如果未提供摘要，则根据正文自动生成
    if (summary === undefined && dto.content !== undefined) {
      data.summary = generateDocumentSummary(data.content as string | null | undefined);
    } else if (summary !== undefined) {
      data.summary = summary;
    }
    if (dto.status === ContentStatus.PUBLISHED && !dto.publishedAt) {
      data.publishedAt = new Date();
    }
    if (editorId) {
      data.author = await resolveContentAuthor(this.prisma, editorId);
    }
    Object.assign(data, await applyContentEditorMetadata(this.prisma, editorId, dto.status));
    return this.prisma.news.create({ data });
  }

  async update(id: string, dto: UpdateNewsDto, editorId?: string) {
    const item = await this.prisma.news.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`新闻 ID "${id}" 未找到`);

    const { author: _author, summary, ...rest } = dto;
    const data: Prisma.NewsUpdateInput = { ...rest };
    if (dto.content !== undefined) {
      data.content = sanitizeMarkdown(dto.content);
    }
    // 如果提供了新摘要，使用它；否则如果正文被更新，重新生成摘要
    if (summary !== undefined) {
      data.summary = summary;
    } else if (dto.content !== undefined) {
      const contentToUse = data.content as string | null | undefined;
      data.summary = generateDocumentSummary(contentToUse);
    }
    // 首次转为已发布且未设置发布时间时，自动记录发布时间
    if (dto.status === ContentStatus.PUBLISHED && !dto.publishedAt && !item.publishedAt) {
      data.publishedAt = new Date();
    }
    if (editorId) {
      data.author = await resolveContentAuthor(this.prisma, editorId);
    }
    Object.assign(
      data,
      await applyContentEditorMetadata(this.prisma, editorId, dto.status ?? item.status, item),
    );
    return this.prisma.news.update({ where: { id }, data });
  }

  async remove(id: string) {
    const item = await this.prisma.news.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`新闻 ID "${id}" 未找到`);
    await this.prisma.news.delete({ where: { id } });
    return { deleted: true };
  }
}
