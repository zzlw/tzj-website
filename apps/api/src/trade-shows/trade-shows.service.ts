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
import { CreateTradeShowDto, UpdateTradeShowDto } from './dto/trade-show.dto';

const LIST_SORT_FIELDS = [
  'title',
  'eventType',
  'location',
  'status',
  'startDate',
  'publishedAt',
  'createdAt',
  'updatedAt',
  'createdById',
  'lastOperatorId',
] as const;

interface FindAllParams {
  page: number;
  limit: number;
  eventType?: string;
  status?: string;
  search?: string;
  includeUnpublished?: boolean;
  sortBy?: string;
  sortOrder?: string;
}

@Injectable()
export class TradeShowsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 营销活动 30s 内存缓存（同 RolesService 权限缓存模式；多实例靠 TTL 最终一致） */
  private marketingCache: { data: unknown[]; expireAt: number } | null = null;

  /** 公开接口字段白名单：不泄露 location/boothNumber/计数/审计字段 */
  private static readonly MARKETING_SELECT = {
    id: true,
    slug: true,
    title: true,
    content: true,
    coverImage: true,
    // 弹窗专用头图：前端优先用它，留空回退 coverImage（封面图与弹窗图区分运营）
    popupImage: true,
    // 弹窗专用文案：前端优先用它，留空回退 content（详情正文不再与弹窗共用）
    popupContent: true,
    eventType: true,
    triggerMode: true,
    delaySeconds: true,
    frequency: true,
    excludePages: true,
    targetDevice: true,
    ctaText: true,
    // CTA 跳转目标：直接复用官网链接，留空时前端回退站内详情页
    externalUrl: true,
  } satisfies Prisma.TradeShowSelect;

  /** 计数字段只允许经 increment 路径变更：全局 ValidationPipe 暂为 whitelist:false，DTO 未声明键不会被剥除，
   *  写库前显式剔除防请求体篡改；whitelist 开启后本保护冗余但无害 */
  private static stripCounterKeys(data: Record<string, unknown>) {
    delete data.viewCount;
    delete data.popupViewCount;
    delete data.popupClickCount;
  }

  /** 当前生效的营销弹窗活动（最多 1 条，多个候选取 sortOrder 最高） */
  async findActiveMarketing() {
    if (this.marketingCache && this.marketingCache.expireAt > Date.now()) {
      return this.marketingCache.data;
    }
    const now = new Date();
    const data = await this.prisma.tradeShow.findMany({
      where: {
        isMarketing: true,
        status: ContentStatus.PUBLISHED,
        OR: [{ startDate: null }, { startDate: { lte: now } }],
        AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
      },
      // Postgres DESC 默认 NULLS FIRST，显式 nulls last 防历史 null publishedAt 行排最前
      orderBy: [{ sortOrder: 'desc' }, { publishedAt: { sort: 'desc', nulls: 'last' } }],
      take: 1,
      select: TradeShowsService.MARKETING_SELECT,
    });
    this.marketingCache = { data, expireAt: Date.now() + 30_000 };
    return data;
  }

  /** 弹窗曝光/点击计数：updateMany 带窗口条件，单条 SQL 原子完成「校验 + 计数」，防对任意行/过期活动刷计数 */
  async recordPopupEvent(id: string, type: 'view' | 'click') {
    const now = new Date();
    const result = await this.prisma.tradeShow.updateMany({
      where: {
        id,
        isMarketing: true,
        status: ContentStatus.PUBLISHED,
        OR: [{ startDate: null }, { startDate: { lte: now } }],
        AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
      },
      data:
        type === 'view'
          ? { popupViewCount: { increment: 1 } }
          : { popupClickCount: { increment: 1 } },
    });
    if (result.count === 0) throw new NotFoundException('活动不存在、未发布或不在展示窗口内');
  }

  async findAll(params: FindAllParams) {
    const {
      page,
      limit,
      eventType,
      status,
      search,
      includeUnpublished = false,
      sortBy,
      sortOrder,
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.TradeShowWhereInput = {
      ...applyPublishedFilter(includeUnpublished),
    };
    // 后台（已登录）可按具体发布状态过滤；公开访问恒为「仅已发布」，忽略该参数以防越权查看草稿/归档。
    if (status && includeUnpublished) where.status = status;
    if (eventType) where.eventType = eventType;
    if (search) {
      // OR 模糊匹配业务关键文本字段（标题/摘要/正文/地点/展位号/展示日期），覆盖后台常用检索维度。
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { boothNumber: { contains: search, mode: 'insensitive' } },
        { eventDateLabel: { contains: search, mode: 'insensitive' } },
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
      data: rawData.map((item) => stripInternalContentFields(item, includeUnpublished)),
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

    // 公开访问剥离内部字段（审计 + 营销配置/计数）；后台/预览不剥离，编辑表单回填不受影响
    return stripInternalContentFields(item, includeUnpublished);
  }

  async create(dto: CreateTradeShowDto, editorId?: string) {
    const { summary, ...rest } = dto;
    const data: Prisma.TradeShowCreateInput = { ...rest };
    TradeShowsService.stripCounterKeys(data as Record<string, unknown>);
    if (dto.content !== undefined) {
      data.content = sanitizeMarkdown(dto.content);
    }
    if (dto.popupContent !== undefined) {
      data.popupContent = sanitizeMarkdown(dto.popupContent);
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
    const created = await this.prisma.tradeShow.create({ data });
    this.marketingCache = null;
    return created;
  }

  async update(id: string, dto: UpdateTradeShowDto, editorId?: string) {
    const item = await this.prisma.tradeShow.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`展会 ID "${id}" 未找到`);

    const { summary, ...rest } = dto;
    const data: Prisma.TradeShowUpdateInput = { ...rest };
    TradeShowsService.stripCounterKeys(data as Record<string, unknown>);
    if (dto.content !== undefined) {
      data.content = sanitizeMarkdown(dto.content);
    }
    if (dto.popupContent !== undefined) {
      data.popupContent = sanitizeMarkdown(dto.popupContent);
    }
    // 如果提供了新摘要，使用它；否则如果正文被更新，重新生成摘要
    if (summary !== undefined) {
      data.summary = summary;
    } else if (dto.content !== undefined) {
      const contentToUse = data.content as string | null | undefined;
      data.summary = generateDocumentSummary(contentToUse);
    }
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
    const updated = await this.prisma.tradeShow.update({ where: { id }, data });
    this.marketingCache = null;
    return updated;
  }

  async remove(id: string) {
    const item = await this.prisma.tradeShow.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`展会 ID "${id}" 未找到`);
    await this.prisma.tradeShow.delete({ where: { id } });
    this.marketingCache = null;
    return { deleted: true };
  }
}
