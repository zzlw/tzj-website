import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client/index';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { IpLocationService } from '../analytics/ip-location.service';
import { formatGeoLabel } from '../analytics/utils/geo-label';
import { resolveContentAuthor } from '../common/utils/content-author';
import { LAST_OPERATOR_USER_SELECT } from '../common/utils/content-list';
import type { NotificationService } from '../notifications/notification.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { CreateContactDto, UpdateContactDto } from './dto/contact.dto';

interface FindAllParams {
  page: number;
  limit: number;
  isRead?: boolean;
  isHandled?: boolean;
}

const CONTACT_OPERATOR_INCLUDE = {
  lastOperatorUser: { select: LAST_OPERATOR_USER_SELECT },
} as const;

/**
 * 询盘访客画像（GET /contact/:id/visitor-profile）：对齐「访客分析」的数据与
 * 「依据 IP 取位置」原理——地区在读取时按原始 IP 重解析（省市区 + 运营商），
 * 并聚合该访客站内 PV/UV/会话数/首末访问/营销归因。原始 IP 不外泄，仅返回脱敏 ipMasked。
 */
export interface ContactVisitorProfile {
  ipMasked: string | null;
  /** 读取时重解析的最精确地址，失败回退入库 GeoIP 值 */
  location: string | null;
  /** 运营商（仅 IP 解析命中时有值） */
  isp: string | null;
  /** 定位依据：ip（重解析）| geoip（入库粗定位）| unknown */
  geoSource: 'ip' | 'geoip' | 'unknown';
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  referrer: string | null;
  referrerHost: string | null;
  landingPath: string | null;
  visitorId: string | null;
  pageViews: number | null;
  sessions: number | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  trafficSource: string | null;
  /** 是否在分析中匹配到该询盘的浏览轨迹 */
  matched: boolean;
  /** 已转化的客户 ID（该询盘已转线索时有值） */
  convertedCustomerId: string | null;
}

/** page_views 聚合原始行（bigint 计数 + 最新/首触非空值） */
interface ContactBehaviorRow {
  pageViews: bigint;
  sessions: bigint;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  ip: string | null;
  ipMasked: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  geoSource: string | null;
  visitorId: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  referrer: string | null;
  referrerHost: string | null;
  landingPath: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  trafficSource: string | null;
}

const EMPTY_PROFILE: ContactVisitorProfile = {
  ipMasked: null,
  location: null,
  isp: null,
  geoSource: 'unknown',
  deviceType: null,
  browser: null,
  os: null,
  referrer: null,
  referrerHost: null,
  landingPath: null,
  visitorId: null,
  pageViews: null,
  sessions: null,
  firstSeenAt: null,
  lastSeenAt: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  trafficSource: null,
  matched: false,
  convertedCustomerId: null,
};

function nullableTrim(v: string | null | undefined): string | null {
  const s = v?.trim();
  return s ? s : null;
}

function toIso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

/** 定位依据：IP 重解析命中 > 入库粗定位 > 未知（独立分支避免嵌套三元，降复杂度）。 */
function resolveGeoSource(
  resolvedByIp: boolean,
  hasLocation: boolean,
): ContactVisitorProfile['geoSource'] {
  if (resolvedByIp) return 'ip';
  if (hasLocation) return 'geoip';
  return 'unknown';
}

@Injectable()
export class ContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly ipLocation: IpLocationService,
  ) {}

  async findAll(params: FindAllParams) {
    const { page, limit, isRead, isHandled } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.ContactWhereInput = {};
    if (isRead !== undefined) where.isRead = isRead;
    if (isHandled !== undefined) where.isHandled = isHandled;

    const [data, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: CONTACT_OPERATOR_INCLUDE,
      }),
      this.prisma.contact.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const item = await this.prisma.contact.findUnique({
      where: { id },
      include: CONTACT_OPERATOR_INCLUDE,
    });
    if (!item) throw new NotFoundException(`联系信息 ID "${id}" 未找到`);
    return item;
  }

  /**
   * 询盘访客画像：按原始 IP 读取时重解析地区 + 聚合站内行为/营销归因。
   * 询盘与分析的关联依靠 identify（提交时 userId=contactId 回写 page_views.userId
   * 并 upsert visitors），因此按 contactId / email 反查该访客的浏览轨迹。
   */
  async getVisitorProfile(id: string): Promise<ContactVisitorProfile> {
    const contact = await this.prisma.contact.findUnique({
      where: { id },
      select: { id: true, email: true },
    });
    if (!contact) throw new NotFoundException(`联系信息 ID "${id}" 未找到`);

    const convertedCustomerId = await this.resolveConvertedCustomerId(id);
    const visitorIds = await this.resolveVisitorIds(id, contact.email);
    const row = await this.aggregateContactBehavior(id, visitorIds);
    if (!row || Number(row.pageViews) === 0) {
      return { ...EMPTY_PROFILE, convertedCustomerId };
    }

    const resolved = await this.ipLocation.resolve(row.ip);
    const fallback = formatGeoLabel({ country: row.country, region: row.region, city: row.city });
    const location = resolved?.location ?? (fallback === '未知' ? null : fallback);
    return {
      ipMasked: row.ipMasked,
      location,
      isp: nullableTrim(resolved?.isp),
      geoSource: resolveGeoSource(Boolean(resolved), Boolean(location)),
      deviceType: row.deviceType,
      browser: row.browser,
      os: row.os,
      referrer: row.referrer,
      referrerHost: row.referrerHost,
      landingPath: row.landingPath,
      visitorId: row.visitorId,
      pageViews: Number(row.pageViews),
      sessions: Number(row.sessions),
      firstSeenAt: toIso(row.firstSeenAt),
      lastSeenAt: toIso(row.lastSeenAt),
      utmSource: row.utmSource,
      utmMedium: row.utmMedium,
      utmCampaign: row.utmCampaign,
      trafficSource: row.trafficSource,
      matched: true,
      convertedCustomerId,
    };
  }

  /** 该询盘是否已转化为客户（按 Customer.contactId 反查）。 */
  private async resolveConvertedCustomerId(contactId: string): Promise<string | null> {
    const customer = await this.prisma.customer.findUnique({
      where: { contactId },
      select: { id: true },
    });
    return customer?.id ?? null;
  }

  /** 收集该询盘关联的匿名访客 ID（identify 回写的 userId 或同邮箱识别身份）。 */
  private async resolveVisitorIds(contactId: string, email: string | null): Promise<string[]> {
    const or: Prisma.VisitorWhereInput[] = [{ userId: contactId }];
    if (email) or.push({ email });
    const visitors = await this.prisma.visitor.findMany({
      where: { OR: or },
      select: { anonymousId: true },
      take: 50,
    });
    return visitors.map((v) => v.anonymousId);
  }

  /**
   * 单行聚合该询盘访客的 page_views：PV/UV/首末访问 + 最新非空地区/设备/IP
   * + 首触 UTM/落地页（按 userId=contactId 或 visitorId 归并，剔除爬虫）。
   */
  private async aggregateContactBehavior(
    contactId: string,
    visitorIds: string[],
  ): Promise<ContactBehaviorRow | null> {
    const scope =
      visitorIds.length > 0
        ? Prisma.sql`("userId" = ${contactId} OR "visitorId" IN (${Prisma.join(visitorIds)}))`
        : Prisma.sql`"userId" = ${contactId}`;
    const rows = await this.prisma.$queryRaw<ContactBehaviorRow[]>(Prisma.sql`
      SELECT
        COUNT(*)::bigint AS "pageViews",
        COUNT(DISTINCT "sessionId")::bigint AS "sessions",
        MIN("createdAt") AS "firstSeenAt",
        MAX("createdAt") AS "lastSeenAt",
        (ARRAY_AGG(ip ORDER BY "createdAt" DESC) FILTER (WHERE ip IS NOT NULL))[1] AS ip,
        (ARRAY_AGG("ipMasked" ORDER BY "createdAt" DESC) FILTER (WHERE "ipMasked" IS NOT NULL))[1] AS "ipMasked",
        (ARRAY_AGG(country ORDER BY "createdAt" DESC) FILTER (WHERE country IS NOT NULL))[1] AS country,
        (ARRAY_AGG(region ORDER BY "createdAt" DESC) FILTER (WHERE region IS NOT NULL))[1] AS region,
        (ARRAY_AGG(city ORDER BY "createdAt" DESC) FILTER (WHERE city IS NOT NULL))[1] AS city,
        (ARRAY_AGG("geoSource" ORDER BY "createdAt" DESC) FILTER (WHERE "geoSource" IS NOT NULL))[1] AS "geoSource",
        (ARRAY_AGG("visitorId" ORDER BY "createdAt" DESC) FILTER (WHERE "visitorId" IS NOT NULL))[1] AS "visitorId",
        (ARRAY_AGG("deviceType" ORDER BY "createdAt" DESC) FILTER (WHERE "deviceType" IS NOT NULL))[1] AS "deviceType",
        (ARRAY_AGG(browser ORDER BY "createdAt" DESC) FILTER (WHERE browser IS NOT NULL))[1] AS browser,
        (ARRAY_AGG(os ORDER BY "createdAt" DESC) FILTER (WHERE os IS NOT NULL))[1] AS os,
        (ARRAY_AGG(referrer ORDER BY "createdAt" DESC) FILTER (WHERE referrer IS NOT NULL))[1] AS referrer,
        (ARRAY_AGG("referrerHost" ORDER BY "createdAt" DESC) FILTER (WHERE "referrerHost" IS NOT NULL))[1] AS "referrerHost",
        (ARRAY_AGG(path ORDER BY "createdAt" ASC) FILTER (WHERE path IS NOT NULL))[1] AS "landingPath",
        (ARRAY_AGG("utmSource" ORDER BY "createdAt" ASC) FILTER (WHERE "utmSource" IS NOT NULL))[1] AS "utmSource",
        (ARRAY_AGG("utmMedium" ORDER BY "createdAt" ASC) FILTER (WHERE "utmMedium" IS NOT NULL))[1] AS "utmMedium",
        (ARRAY_AGG("utmCampaign" ORDER BY "createdAt" ASC) FILTER (WHERE "utmCampaign" IS NOT NULL))[1] AS "utmCampaign",
        (ARRAY_AGG("trafficSource" ORDER BY "createdAt" ASC) FILTER (WHERE "trafficSource" IS NOT NULL))[1] AS "trafficSource"
      FROM "page_views"
      WHERE ${scope} AND "isBot" = false
    `);
    return rows[0] ?? null;
  }

  async create(dto: CreateContactDto) {
    const contact = await this.prisma.contact.create({
      data: {
        ...dto,
        source: dto.source ?? 'website',
        // 空串归一为 null，避免入库无意义的空访客 ID
        visitorId: nullableTrim(dto.visitorId),
      },
    });
    this.notifications.dispatchContactCreated(contact);
    return contact;
  }

  async update(id: string, dto: UpdateContactDto, operatorId?: string) {
    const item = await this.prisma.contact.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`联系信息 ID "${id}" 未找到`);

    const data: Prisma.ContactUncheckedUpdateInput = { ...dto };
    if (operatorId) {
      data.lastOperatorId = operatorId;
      data.lastOperator = await resolveContentAuthor(this.prisma, operatorId);
    }

    return this.prisma.contact.update({
      where: { id },
      data,
      include: CONTACT_OPERATOR_INCLUDE,
    });
  }

  async remove(id: string) {
    const item = await this.prisma.contact.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`联系信息 ID "${id}" 未找到`);
    await this.prisma.contact.delete({ where: { id } });
    return { deleted: true };
  }
}
