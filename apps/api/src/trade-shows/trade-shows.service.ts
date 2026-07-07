import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client/index";
import { CreateTradeShowDto, UpdateTradeShowDto } from "./dto/trade-show.dto";
import { ContentStatus } from "../common/enums/content-status.enum";
import { sanitizeMarkdown } from "../common/utils/markdown";
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
  "eventType",
  "location",
  "status",
  "startDate",
  "publishedAt",
  "createdAt",
  "updatedAt",
  "createdById",
  "lastOperatorId",
] as const;

interface FindAllParams {
  page: number;
  limit: number;
  eventType?: string;
  search?: string;
  includeUnpublished?: boolean;
  sortBy?: string;
  sortOrder?: string;
}

@Injectable()
export class TradeShowsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: FindAllParams) {
    const {
      page,
      limit,
      eventType,
      search,
      includeUnpublished = false,
      sortBy,
      sortOrder,
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.TradeShowWhereInput = {
      ...applyPublishedFilter(includeUnpublished),
    };
    if (eventType) where.eventType = eventType;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
      ];
    }

    const sort = parseListSort(sortBy, sortOrder, LIST_SORT_FIELDS);
    const orderBy = buildListOrderBy(sort, DEFAULT_CONTENT_LIST_ORDER.tradeShows);

    const [rawData, total] = await Promise.all([
      includeUnpublished
        ? this.prisma.tradeShow.findMany({
            where,
            skip,
            take: limit,
            orderBy,
            include: CONTENT_ADMIN_USER_INCLUDE,
          })
        : this.prisma.tradeShow.findMany({
            where,
            skip,
            take: limit,
            orderBy,
          }),
      this.prisma.tradeShow.count({ where }),
    ]);

    return {
      data: rawData.map((item) =>
        stripInternalContentFields(item, includeUnpublished),
      ),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(idOrSlug: string, includeUnpublished = false) {
    const item = await this.prisma.tradeShow.findFirst({
      where: { OR: [{ slug: idOrSlug }, { id: idOrSlug }] },
    });
    if (!item) throw new NotFoundException(`展会 "${idOrSlug}" 未找到`);
    assertPublishedOrStaff(item.status, includeUnpublished);

    // 后台预览（已鉴权）不计入浏览量
    if (!includeUnpublished) {
      await this.prisma.tradeShow.update({
        where: { id: item.id },
        data: { viewCount: { increment: 1 } },
      });
    }

    return item;
  }

  async create(dto: CreateTradeShowDto, editorId?: string) {
    const { summary, ...rest } = dto;
    const data: Prisma.TradeShowCreateInput = { ...rest };
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
    Object.assign(
      data,
      await applyContentEditorMetadata(this.prisma, editorId, dto.status),
    );
    return this.prisma.tradeShow.create({ data });
  }

  async update(id: string, dto: UpdateTradeShowDto, editorId?: string) {
    const item = await this.prisma.tradeShow.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`展会 ID "${id}" 未找到`);

    const { summary, ...rest } = dto;
    const data: Prisma.TradeShowUpdateInput = { ...rest };
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
    return this.prisma.tradeShow.update({ where: { id }, data });
  }

  async remove(id: string) {
    const item = await this.prisma.tradeShow.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`展会 ID "${id}" 未找到`);
    await this.prisma.tradeShow.delete({ where: { id } });
    return { deleted: true };
  }
}
