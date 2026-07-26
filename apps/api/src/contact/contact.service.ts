import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client/index';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { IpLocationService } from '../analytics/ip-location.service';
import { formatGeoLabel } from '../analytics/utils/geo-label';
import { aggregateLastIp, pickLatestIp } from '../analytics/utils/last-ip';
import { resolveContentAuthor } from '../common/utils/content-author';
import { LAST_OPERATOR_USER_SELECT } from '../common/utils/content-list';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { NotificationService } from '../notifications/notification.service';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { PrismaService } from '../prisma/prisma.service';
import type { CreateContactDto, UpdateContactDto } from './dto/contact.dto';

interface FindAllParams {
  page: number;
  limit: number;
  isRead?: boolean;
  isHandled?: boolean;
  search?: string;
  source?: string;
  channel?: string;
  converted?: boolean;
  sortBy?: string;
  sortOrder?: string;
}

/** 来源筛选白名单（与 Contact.source 口径一致：website|admin|api）。 */
const SOURCE_VALUES = new Set(['website', 'admin', 'api']);

/** 来源渠道筛选白名单（与访客中心 trafficSource 口径一致）。 */
const CHANNEL_VALUES = new Set([
  'direct',
  'organic',
  'paid',
  'social',
  'email',
  'referral',
  'other',
]);

/** 白名单：表头排序 key → Contact 字段（防注入 + 区分前端列 key 与库字段）。 */
const SORTABLE: Record<string, keyof Prisma.ContactOrderByWithRelationInput> = {
  name: 'name',
  company: 'company',
  status: 'isHandled',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

const DEFAULT_ORDER: Prisma.ContactOrderByWithRelationInput = { createdAt: 'desc' };

const CONTACT_OPERATOR_INCLUDE = {
  lastOperatorUser: { select: LAST_OPERATOR_USER_SELECT },
} as const;

/** 询盘列表行的富化字段（转化状态 + 最后访问 IP/地区 + 首触来源；IP 与客户表一致，明文展示）。 */
export interface ContactListEnrichment {
  convertedCustomerId: string | null;
  lastIp: string | null;
  lastIpMasked: string | null;
  lastIpHash: string | null;
  /** 最近一次访问的入库地区标签（省 · 市，无则 null） */
  lastRegion: string | null;
  /** 首触来源渠道（与访客中心「来源」列口径一致，无浏览轨迹则 null） */
  channel: string | null;
  /** 首触引荐域名 */
  referrerHost: string | null;
}

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
    const {
      page,
      limit,
      isRead,
      isHandled,
      search,
      source,
      channel,
      converted,
      sortBy,
      sortOrder,
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.ContactWhereInput = {};
    if (isRead !== undefined) where.isRead = isRead;
    if (isHandled !== undefined) where.isHandled = isHandled;
    if (source && SOURCE_VALUES.has(source)) where.source = source;
    if (converted !== undefined) where.id = await this.buildConvertedIdFilter(converted);
    // 渠道筛选走 AND，避免与搜索的 where.OR 互斥
    if (channel && CHANNEL_VALUES.has(channel)) where.AND = [await this.buildChannelWhere(channel)];
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { company: { contains: q } },
        { phone: { contains: q } },
        { email: { contains: q } },
        { subject: { contains: q } },
        { message: { contains: q } },
      ];
    }

    const dir: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';

    // 转化状态非库字段（Customer.contactId 弱引用反查），无法用 orderBy 表达，走两段分页拼接
    if (sortBy === 'converted') {
      const [data, total] = await Promise.all([
        this.findPageSortedByConverted(where, dir, skip, limit),
        this.prisma.contact.count({ where }),
      ]);
      return {
        data: await this.enrichListRows(data),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    }

    // 地区/来源/最后访问 IP 为富化字段（page_views 反查），同样无法用 orderBy 表达，走全量富化后内存排序
    if (sortBy === 'region' || sortBy === 'channel' || sortBy === 'lastIp') {
      return this.findPageSortedByEnrichment(where, sortBy, dir, page, limit);
    }

    const orderBy: Prisma.ContactOrderByWithRelationInput =
      sortBy && SORTABLE[sortBy] ? { [SORTABLE[sortBy]]: dir } : DEFAULT_ORDER;

    const [data, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: CONTACT_OPERATOR_INCLUDE,
      }),
      this.prisma.contact.count({ where }),
    ]);

    return {
      data: await this.enrichListRows(data),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * 转化状态筛选：Contact 与 Customer 无 Prisma 关系（仅 Customer.contactId 弱引用），
   * 以反查 contactId 集合的方式过滤。客户表量级小（询盘转线索是低频动作），全量取 ID 可接受。
   */
  private async buildConvertedIdFilter(converted: boolean): Promise<Prisma.StringFilter> {
    const ids = await this.loadConvertedContactIds();
    return converted ? { in: ids } : { notIn: ids };
  }

  /** 已转客户的源询盘 ID 全量（转化筛选/排序共用，单次查询）。 */
  private async loadConvertedContactIds(): Promise<string[]> {
    const rows = await this.prisma.customer.findMany({
      where: { contactId: { not: null } },
      select: { contactId: true },
    });
    return rows.map((r) => r.contactId).filter((v): v is string => Boolean(v));
  }

  /**
   * 按转化状态排序的单页取数：「已转 / 未转」两段各自按默认次序（createdAt desc）分页拼接，
   * desc=已转客户在前。逐段 count 定位页内偏移，跨段页自动补齐（同转化筛选的反查策略）。
   */
  private async findPageSortedByConverted(
    where: Prisma.ContactWhereInput,
    dir: 'asc' | 'desc',
    skip: number,
    take: number,
  ) {
    const ids = await this.loadConvertedContactIds();
    const convertedSeg: Prisma.ContactWhereInput = { AND: [where, { id: { in: ids } }] };
    const unconvertedSeg: Prisma.ContactWhereInput = { AND: [where, { id: { notIn: ids } }] };
    const segments =
      dir === 'desc' ? [convertedSeg, unconvertedSeg] : [unconvertedSeg, convertedSeg];

    const data: Prisma.ContactGetPayload<{ include: typeof CONTACT_OPERATOR_INCLUDE }>[] = [];
    let offset = skip;
    for (const segWhere of segments) {
      if (data.length >= take) break;
      const segCount = await this.prisma.contact.count({ where: segWhere });
      if (offset >= segCount) {
        offset -= segCount;
        continue;
      }
      const rows = await this.prisma.contact.findMany({
        where: segWhere,
        skip: offset,
        take: take - data.length,
        orderBy: DEFAULT_ORDER,
        include: CONTACT_OPERATOR_INCLUDE,
      });
      data.push(...rows);
      offset = 0;
    }
    return data;
  }

  /**
   * 按富化字段（地区 lastRegion / 来源 channel / 最后访问 IP lastIp）排序的分页：
   * 均来自 page_views 反查（enrichListRows），非库字段无法用 orderBy 表达。
   * 询盘量级小（低频动作），全量取行富化后内存排序再切页可接受
   * （同转化排序的全量反查策略）。空值恒置后，同值保持创建时间倒序；
   * IP 用 numeric 比较（按段数值序，79.x < 121.x，同客户表口径）。
   */
  private async findPageSortedByEnrichment(
    where: Prisma.ContactWhereInput,
    sortBy: 'region' | 'channel' | 'lastIp',
    dir: 'asc' | 'desc',
    page: number,
    limit: number,
  ) {
    const rows = await this.prisma.contact.findMany({
      where,
      orderBy: DEFAULT_ORDER,
      include: CONTACT_OPERATOR_INCLUDE,
    });
    const enriched = await this.enrichListRows(rows);
    const key = sortBy === 'region' ? 'lastRegion' : sortBy;
    const numeric = sortBy === 'lastIp';
    const sign = dir === 'asc' ? 1 : -1;
    enriched.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av === bv) return 0; // 稳定排序，同值保持预排的 createdAt 倒序
      if (av === null) return 1;
      if (bv === null) return -1;
      return av.localeCompare(bv, numeric ? 'en' : 'zh-CN', { numeric }) * sign;
    });
    const total = enriched.length;
    const skip = (page - 1) * limit;
    return {
      data: enriched.slice(skip, skip + limit),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * 来源渠道筛选：Contact 无渠道字段，按 page_views 首触 trafficSource 反查
   * 命中的 userId（=contactId，identify 回写）与 visitorId 集合后过滤询盘，
   * 与列表展示的首触归因口径一致。小公司量级下全量分组聚合可接受（同转化筛选策略）。
   */
  private async buildChannelWhere(channel: string): Promise<Prisma.ContactWhereInput> {
    const [userKeys, visitorKeys] = await Promise.all([
      this.findFirstChannelKeys('userId', channel),
      this.findFirstChannelKeys('visitorId', channel),
    ]);
    return { OR: [{ id: { in: userKeys } }, { visitorId: { in: visitorKeys } }] };
  }

  /** 按 key 列分组聚合 page_views，返回首触 trafficSource 命中给定渠道的 key 集合。 */
  private async findFirstChannelKeys(
    keyColumn: 'userId' | 'visitorId',
    channel: string,
  ): Promise<string[]> {
    const column = Prisma.raw(`"${keyColumn}"`);
    const rows = await this.prisma.$queryRaw<Array<{ key: string }>>(Prisma.sql`
      SELECT ${column} AS "key"
      FROM "page_views"
      WHERE "isBot" = false AND ${column} IS NOT NULL
      GROUP BY ${column}
      HAVING (ARRAY_AGG("trafficSource" ORDER BY "createdAt" ASC) FILTER (WHERE "trafficSource" IS NOT NULL))[1] = ${channel}
    `);
    return rows.map((r) => r.key);
  }

  /**
   * 列表行富化：为每条询盘补充转化状态与「最后访问 IP / 地区」（明文 + 脱敏 + ipHash 用于抽屉下钻）。
   * - convertedCustomerId：按 Customer.contactId 反查（批量）。
   * - lastIp / lastIpMasked / lastIpHash / lastRegion / channel / referrerHost：从 page_views
   *   聚合最近一次非空 IP、地区与首触来源（与访客中心「来源」列口径一致），
   *   关联口径为 userId=contactId（identify 回写）或 visitorId=contact.visitorId（会话来源）。
   *   与客户表口径一致，列表明文展示 IP。
   */
  private async enrichListRows<T extends { id: string; visitorId: string | null }>(
    contacts: T[],
  ): Promise<Array<T & ContactListEnrichment>> {
    if (contacts.length === 0) return [];
    const ids = contacts.map((c) => c.id);
    const visitorIds = contacts.map((c) => c.visitorId).filter((v): v is string => Boolean(v));

    const [customers, byUser, byVisitor] = await Promise.all([
      this.prisma.customer.findMany({
        where: { contactId: { in: ids } },
        select: { id: true, contactId: true },
      }),
      aggregateLastIp(this.prisma, 'userId', ids),
      visitorIds.length
        ? aggregateLastIp(this.prisma, 'visitorId', visitorIds)
        : Promise.resolve([]),
    ]);

    const convertedMap = new Map<string, string>();
    for (const c of customers) {
      if (c.contactId) convertedMap.set(c.contactId, c.id);
    }
    const userIpMap = new Map(byUser.map((r) => [r.key, r]));
    const visitorIpMap = new Map(byVisitor.map((r) => [r.key, r]));

    return contacts.map((c) => {
      const viaUser = userIpMap.get(c.id);
      const viaVisitor = c.visitorId ? visitorIpMap.get(c.visitorId) : undefined;
      // 两条关联口径都可能命中，取最近一次访问的那条
      const best = pickLatestIp(viaUser, viaVisitor);
      const regionLabel = best
        ? formatGeoLabel({ country: best.country, region: best.region, city: best.city })
        : '未知';
      return {
        ...c,
        convertedCustomerId: convertedMap.get(c.id) ?? null,
        lastIp: best?.lastIp ?? null,
        lastIpMasked: best?.lastIpMasked ?? null,
        lastIpHash: best?.lastIpHash ?? null,
        lastRegion: regionLabel === '未知' ? null : regionLabel,
        channel: best?.channel ?? null,
        referrerHost: best?.referrerHost ?? null,
      };
    });
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
