import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client/index';
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
import { CreateCaseDto, UpdateCaseDto } from './dto/case.dto';

const LIST_SORT_FIELDS = [
  'title',
  'caseType',
  'location',
  'status',
  'completionDate',
  'createdAt',
  'updatedAt',
  'createdById',
  'lastOperatorId',
] as const;

interface FindAllParams {
  page: number;
  limit: number;
  caseType?: string;
  status?: string;
  search?: string;
  includeUnpublished?: boolean;
  sortBy?: string;
  sortOrder?: string;
}

@Injectable()
export class CasesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: FindAllParams) {
    const { page, limit, caseType, status, search, includeUnpublished = false, sortBy, sortOrder } =
      params;
    const skip = (page - 1) * limit;

    const where: Prisma.CaseWhereInput = {
      ...applyPublishedFilter(includeUnpublished),
    };
    // 后台（已登录）可按具体发布状态过滤；公开访问恒为「仅已发布」，忽略该参数以防越权查看草稿/归档。
    if (status && includeUnpublished) where.status = status;
    if (caseType) where.caseType = caseType;
    if (search) {
      // OR 模糊匹配业务关键文本字段（标题/摘要/详情/地点/客户），覆盖后台常用检索维度。
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { client: { contains: search, mode: 'insensitive' } },
      ];
    }

    const sort = parseListSort(sortBy, sortOrder, LIST_SORT_FIELDS);
    const orderBy = buildListOrderBy(sort, DEFAULT_CONTENT_LIST_ORDER.cases);

    const [rawData, total] = await Promise.all([
      includeUnpublished
        ? this.prisma.case.findMany({
            where,
            skip,
            take: limit,
            orderBy,
            include: CONTENT_ADMIN_USER_INCLUDE,
          })
        : this.prisma.case.findMany({
            where,
            skip,
            take: limit,
            orderBy,
          }),
      this.prisma.case.count({ where }),
    ]);

    return {
      data: rawData.map((item) => stripInternalContentFields(item, includeUnpublished)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(idOrSlug: string, includeUnpublished = false) {
    const item = await this.prisma.case.findFirst({
      where: { OR: [{ slug: idOrSlug }, { id: idOrSlug }] },
    });
    if (!item) throw new NotFoundException(`案例 "${idOrSlug}" 未找到`);
    assertPublishedOrStaff(item.status, includeUnpublished);

    // 后台预览（已鉴权）不计入浏览量
    if (!includeUnpublished) {
      await this.prisma.case.update({
        where: { id: item.id },
        data: { viewCount: { increment: 1 } },
      });
    }

    return item;
  }

  async create(dto: CreateCaseDto, editorId?: string) {
    const { description, summary, ...rest } = dto;
    const sanitizedDescription = sanitizeMarkdown(description);
    // 如果未提供摘要，则根据正文自动生成
    const finalSummary = summary ?? generateDocumentSummary(sanitizedDescription);
    const data: Prisma.CaseCreateInput = {
      ...rest,
      summary: finalSummary,
      description: sanitizedDescription,
    };
    if (editorId) {
      data.author = await resolveContentAuthor(this.prisma, editorId);
    }
    Object.assign(data, await applyContentEditorMetadata(this.prisma, editorId, dto.status));
    return this.prisma.case.create({ data });
  }

  async update(id: string, dto: UpdateCaseDto, editorId?: string) {
    const item = await this.prisma.case.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`案例 ID "${id}" 未找到`);
    const { description, summary, ...rest } = dto;
    const data: Prisma.CaseUpdateInput = { ...rest };
    if (description !== undefined) {
      data.description = sanitizeMarkdown(description);
    }
    // 如果提供了新摘要，使用它；否则如果正文被更新，重新生成摘要
    if (summary !== undefined) {
      data.summary = summary;
    } else if (description !== undefined) {
      const contentToUse = data.description as string | null | undefined;
      data.summary = generateDocumentSummary(contentToUse);
    }
    if (editorId) {
      data.author = await resolveContentAuthor(this.prisma, editorId);
    }
    Object.assign(
      data,
      await applyContentEditorMetadata(this.prisma, editorId, dto.status ?? item.status, item),
    );
    return this.prisma.case.update({ where: { id }, data });
  }

  async remove(id: string) {
    const item = await this.prisma.case.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`案例 ID "${id}" 未找到`);
    await this.prisma.case.delete({ where: { id } });
    return { deleted: true };
  }
}
