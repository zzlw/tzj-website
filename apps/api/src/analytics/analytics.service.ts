import { Injectable } from '@nestjs/common';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client/index';
import type { Request } from 'express';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { IntegrationsService } from '../integrations/integrations.service';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { PrismaService } from '../prisma/prisma.service';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { IpBanService } from '../security/ip-ban.service';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { SettingsService } from '../settings/settings.service';
import type { CollectPageViewDto } from './dto/collect-pageview.dto';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { IpLocationService } from './ip-location.service';
import {
  type AnalyticsListParams,
  ipDetailGroupWhereSql,
  ipDetailSearchSql,
  pageOrderClause,
  paginateMeta,
  referrerOrderClause,
  regionOrderClause,
  visitorBaseFilterSql,
  visitorConvertedFlagSql,
  visitorDetailOrderClause,
  visitorGroupWhereSql,
  visitorOrderClause,
} from './utils/analytics-list';
import { extractClientIp, hashIp, maskIp, parseReferrerHost } from './utils/client-ip';
import { lookupGeo } from './utils/geo-ip';
import { formatGeoLabel, formatGeoSource } from './utils/geo-label';
import { lookupGeoFromCoordinates } from './utils/geo-reverse';
import {
  CASE_PATH_SEGMENTS,
  CONTACT_PATH_SEGMENTS,
  keyPageTouchedSql,
  touchedCase,
  touchedContact,
} from './utils/key-pages';
import { classifyTrafficSource } from './utils/traffic-source';
import { parseUserAgent } from './utils/ua-parser';

interface DateRange {
  from: Date;
  to: Date;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function parseRange(from?: string, to?: string): DateRange {
  const now = new Date();
  const toDate = to ? new Date(to) : now;
  const fromDate = from ? new Date(from) : new Date(now.getTime() - 6 * 86400000);
  return {
    from: startOfDay(fromDate),
    to: endOfDay(Number.isNaN(toDate.getTime()) ? now : toDate),
  };
}

function humanWhere(range: DateRange): Prisma.PageViewWhereInput {
  return {
    isBot: false,
    createdAt: { gte: range.from, lte: range.to },
  };
}

// ── 趋势图时间粒度（与 admin lib/analytics-granularity.ts 阈值保持一致）──────────
// date_trunc 单位；hour/day/week/month。范围跨度决定「合法粒度」与「自动默认」，
// 避免小时粒度在长跨度下产生数千个桶。后端为权威：非法/缺省一律回落到自动默认。
type Granularity = 'hour' | 'day' | 'week' | 'month';

function spanDaysOf(range: DateRange): number {
  return Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / 86400000) + 1);
}

/** 合法粒度集合：跨度越大，越细的粒度越先被剔除（点数上限约束）。 */
function allowedGranularities(range: DateRange): Granularity[] {
  const d = spanDaysOf(range);
  const out: Granularity[] = [];
  if (d <= 7) out.push('hour');
  if (d <= 186) out.push('day');
  if (d <= 1100) out.push('week');
  out.push('month');
  return out;
}

/** 自动默认粒度：始终落在 allowedGranularities 内。 */
function defaultGranularity(range: DateRange): Granularity {
  const d = spanDaysOf(range);
  if (d <= 2) return 'hour';
  if (d <= 92) return 'day';
  if (d <= 730) return 'week';
  return 'month';
}

/** 解析入参粒度：合法则采用，否则回落自动默认。 */
function resolveGranularity(g: string | undefined, range: DateRange): Granularity {
  if (g && allowedGranularities(range).includes(g as Granularity)) return g as Granularity;
  return defaultGranularity(range);
}

/** 将时间截断到粒度桶起点（UTC；与 Postgres date_trunc 边界对齐：周一为周起点）。 */
function truncateBucket(d: Date, unit: Granularity): Date {
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  const day = d.getUTCDate();
  if (unit === 'hour') return new Date(Date.UTC(y, mo, day, d.getUTCHours()));
  if (unit === 'month') return new Date(Date.UTC(y, mo, 1));
  if (unit === 'week') {
    const base = new Date(Date.UTC(y, mo, day));
    const dow = base.getUTCDay(); // 0=周日
    const backToMon = (dow + 6) % 7;
    base.setUTCDate(base.getUTCDate() - backToMon);
    return base;
  }
  return new Date(Date.UTC(y, mo, day)); // day
}

function advanceBucket(d: Date, unit: Granularity): Date {
  const next = new Date(d);
  if (unit === 'hour') next.setUTCHours(next.getUTCHours() + 1);
  else if (unit === 'week') next.setUTCDate(next.getUTCDate() + 7);
  else if (unit === 'month') next.setUTCMonth(next.getUTCMonth() + 1);
  else next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

/** 枚举区间内所有粒度桶起点（用于补零：无数据的桶也占位，避免趋势线断裂）。 */
function enumerateBuckets(range: DateRange, unit: Granularity): Date[] {
  const out: Date[] = [];
  const end = range.to.getTime();
  let cur = truncateBucket(range.from, unit);
  while (cur.getTime() <= end) {
    out.push(cur);
    cur = advanceBucket(cur, unit);
  }
  return out;
}

// 统一将空/空白字符串归一为 null（将 || 收敛至此，避免抬高 collect 复杂度）；供多处复用
function nullableTrim(v?: string | null): string | null {
  return v?.trim() || null;
}

/** getVisitorActivity 查询 PageView 的精简投影行 */
interface VisitorPageViewRow {
  sessionId: string;
  path: string;
  title: string | null;
  createdAt: Date;
  referrerHost: string | null;
  trafficSource: string | null;
  deviceType: string | null;
  deviceModel: string | null;
  deviceVendor: string | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  clientApp: string | null;
  region: string | null;
  city: string | null;
  country: string | null;
  // 网络维度（仅 getVisitorActivity 查询，按 visitorId 归并跨 IP 时用；IP 抽屉不选，故可选）
  ipHash?: string | null;
  ipMasked?: string | null;
  ip?: string | null;
}

// 时间正序 views 中「最近一次」非空值（用于设备/地区等取代表值）
function latestValue(
  views: VisitorPageViewRow[],
  pick: (v: VisitorPageViewRow) => string | null,
): string | null {
  for (let i = views.length - 1; i >= 0; i--) {
    const item = views[i];
    const val = item ? pick(item) : null;
    if (val != null) return val;
  }
  return null;
}

// 时间正序 views 中「首触」非空值（用于渠道/引荐域名归因）
function firstValue(
  views: VisitorPageViewRow[],
  pick: (v: VisitorPageViewRow) => string | null,
): string | null {
  for (const v of views) {
    const val = pick(v);
    if (val != null) return val;
  }
  return null;
}

// 按 sessionId 分组为会话（views 已按 createdAt 正序），会话按开始时间倒序
function groupVisitorSessions(views: VisitorPageViewRow[]) {
  const map = new Map<string, VisitorPageViewRow[]>();
  for (const v of views) {
    const list = map.get(v.sessionId);
    if (list) list.push(v);
    else map.set(v.sessionId, [v]);
  }
  const sessions = Array.from(map.values()).map(buildVisitorSession);
  sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return sessions;
}

// 将同一会话的 PageView 组（非空、时间正序）折叠为会话摘要
function buildVisitorSession(group: VisitorPageViewRow[]) {
  const first = group[0] ?? group[group.length - 1];
  const last = group[group.length - 1] ?? first;
  return {
    sessionId: first?.sessionId ?? '',
    startedAt: first?.createdAt.toISOString() ?? '',
    endedAt: last?.createdAt.toISOString() ?? '',
    // 会话内首末 PageView 时间差（约，非真实停留时长）
    durationMs: first && last ? last.createdAt.getTime() - first.createdAt.getTime() : 0,
    pageCount: group.length,
    channel: first?.trafficSource ?? null, // 首触渠道
    referrerHost: first?.referrerHost ?? null,
    deviceType: last?.deviceType ?? null,
    deviceModel: last?.deviceModel ?? null,
    deviceVendor: last?.deviceVendor ?? null,
    browser: last?.browser ?? null,
    browserVersion: last?.browserVersion ?? null,
    os: last?.os ?? null,
    osVersion: last?.osVersion ?? null,
    clientApp: last?.clientApp ?? null,
    views: group.map((v) => ({
      path: v.path,
      title: v.title ?? null,
      createdAt: v.createdAt.toISOString(),
    })),
  };
}

// 汇总最近设备/地区 + 首触渠道/引荐域名
function buildVisitorTechInfo(views: VisitorPageViewRow[]) {
  return {
    deviceType: latestValue(views, (v) => v.deviceType),
    deviceModel: latestValue(views, (v) => v.deviceModel),
    deviceVendor: latestValue(views, (v) => v.deviceVendor),
    browser: latestValue(views, (v) => v.browser),
    browserVersion: latestValue(views, (v) => v.browserVersion),
    os: latestValue(views, (v) => v.os),
    osVersion: latestValue(views, (v) => v.osVersion),
    clientApp: latestValue(views, (v) => v.clientApp),
    region: latestValue(views, (v) => v.region),
    city: latestValue(views, (v) => v.city),
    country: latestValue(views, (v) => v.country),
    channel: firstValue(views, (v) => v.trafficSource),
    referrerHost: firstValue(views, (v) => v.referrerHost),
  };
}

/** 全量导出单次上限（防超大导出拖垮查询与浏览器） */
const EXPORT_MAX_ROWS = 5000;

/** 首访→询盘的天数（保留 1 位小数，负值归 0：询盘早于筛选区间内首访时视为当日转化） */
function diffDaysNonNegative(fromIso: string, to: Date): number {
  const from = new Date(fromIso).getTime();
  if (Number.isNaN(from)) return 0;
  return Math.max(0, Math.round(((to.getTime() - from) / 86_400_000) * 10) / 10);
}

/** 转化反查命中的询盘引用（最早一条） */
interface ContactRef {
  id: string;
  createdAt: Date;
}

/** Contact 匹配条件：visitorId（埋点同源锚定）为主、email 为辅；两者皆空返回空数组 */
function buildContactMatchOr(visitorIds: string[], emails: string[]): Prisma.ContactWhereInput[] {
  const or: Prisma.ContactWhereInput[] = [];
  if (visitorIds.length > 0) or.push({ visitorId: { in: visitorIds } });
  if (emails.length > 0) or.push({ email: { in: emails } });
  return or;
}

/** 时间正序询盘建索引：visitorId / email 各保留最早一条 */
function indexEarliestContacts(
  contacts: Array<{ id: string; visitorId: string | null; email: string | null; createdAt: Date }>,
) {
  const byVisitorId = new Map<string, ContactRef>();
  const byEmail = new Map<string, ContactRef>();
  for (const c of contacts) {
    const entry = { id: c.id, createdAt: c.createdAt };
    if (c.visitorId && !byVisitorId.has(c.visitorId)) byVisitorId.set(c.visitorId, entry);
    if (c.email && !byEmail.has(c.email)) byEmail.set(c.email, entry);
  }
  return { byVisitorId, byEmail };
}

/** 转化归因反查出的询盘行（含 identify 回写场景需要的 id 键） */
type LeadContactRow = {
  id: string;
  visitorId: string | null;
  email: string | null;
  createdAt: Date;
};

/** 时间倒序询盘建索引：询盘 id / visitorId / email 各保留最近一条（desc 首次写入即最近） */
function indexLatestContactsByKey(contacts: LeadContactRow[]): Map<string, ContactRef> {
  const latestByKey = new Map<string, ContactRef>();
  for (const c of contacts) {
    for (const key of [c.id, c.visitorId, c.email]) {
      if (key && !latestByKey.has(key)) latestByKey.set(key, { id: c.id, createdAt: c.createdAt });
    }
  }
  return latestByKey;
}

/** 已转客户建索引：Customer.visitorId / contactId 及其询盘的 visitorId / email 均指向客户 ID */
function indexConvertedCustomersByKey(
  customers: Array<{ id: string; contactId: string | null; visitorId: string | null }>,
  contactById: Map<string, LeadContactRow>,
): Map<string, string> {
  const convertedByKey = new Map<string, string>();
  for (const cust of customers) {
    const contact = cust.contactId ? contactById.get(cust.contactId) : undefined;
    for (const key of [cust.visitorId, cust.contactId, contact?.visitorId, contact?.email]) {
      if (key && !convertedByKey.has(key)) convertedByKey.set(key, cust.id);
    }
  }
  return convertedByKey;
}

/** 单行转化归因：多路身份键命中时取创建时间最近的询盘作去重锚点，任一键命中即视为已转客户 */
function resolveRowLeadStatus(
  keys: string[],
  latestByKey: Map<string, ContactRef>,
  convertedByKey: Map<string, string>,
): { latestContactId: string | null; convertedCustomerId: string | null } {
  let latest: ContactRef | null = null;
  let converted: string | null = null;
  for (const key of keys) {
    const hit = latestByKey.get(key);
    if (hit && (!latest || hit.createdAt > latest.createdAt)) latest = hit;
    converted ??= convertedByKey.get(key) ?? null;
  }
  return { latestContactId: latest?.id ?? null, convertedCustomerId: converted };
}

/** buildVisitorNetworks 的单个网络（ipHash）聚合桶 */
interface VisitorNetworkBucket {
  ip: string | null;
  ipMasked: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  pageViews: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

/** 向已有网络桶归并一条 PageView：累计浏览量、拓宽首末时间，并回填早期数据缺失的 IP 列 */
function mergeNetworkView(bucket: VisitorNetworkBucket, v: VisitorPageViewRow): void {
  bucket.pageViews += 1;
  if (v.createdAt < bucket.firstSeenAt) bucket.firstSeenAt = v.createdAt;
  if (v.createdAt > bucket.lastSeenAt) bucket.lastSeenAt = v.createdAt;
  // 同一 ipHash 明文 IP 同源，但早期数据可能缺列，遇非空值回填
  if (!bucket.ip && v.ip) bucket.ip = v.ip;
  if (!bucket.ipMasked && v.ipMasked) bucket.ipMasked = v.ipMasked;
}

/**
 * 该访客用过的网络/地区（按 ipHash 去重）：反映「同一个人换了 IP/网络」（visitorId 不变、IP 变）。
 * 按最近使用倒序，展示明文 IP（回退掩码）+ 地区 + 该网络下的浏览量/首末时间；供人物抽屉「历史网络」小节。
 */
function buildVisitorNetworks(views: VisitorPageViewRow[]) {
  const map = new Map<string, VisitorNetworkBucket>();
  for (const v of views) {
    const key = v.ipHash ?? '';
    if (!key) continue;
    const existing = map.get(key);
    if (existing) {
      mergeNetworkView(existing, v);
    } else {
      map.set(key, {
        ip: v.ip ?? null,
        ipMasked: v.ipMasked ?? null,
        country: v.country,
        region: v.region,
        city: v.city,
        pageViews: 1,
        firstSeenAt: v.createdAt,
        lastSeenAt: v.createdAt,
      });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
    .map((n) => ({
      ip: n.ip,
      ipMasked: n.ipMasked,
      region: formatGeoLabel({ country: n.country, region: n.region, city: n.city }),
      pageViews: n.pageViews,
      firstSeenAt: n.firstSeenAt.toISOString(),
      lastSeenAt: n.lastSeenAt.toISOString(),
    }));
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly settingsService: SettingsService,
    private readonly integrationsService: IntegrationsService,
    private readonly ipBanService: IpBanService,
    private readonly ipLocation: IpLocationService,
  ) {}

  async collect(dto: CollectPageViewDto, req: Request) {
    const ua = req.headers['user-agent'];
    const parsed = parseUserAgent(typeof ua === 'string' ? ua : undefined);
    const ip = extractClientIp(req);

    if (ip && (await this.ipBanService.isBlocked(ip))) {
      return { ok: true };
    }

    const salt = this.config.get<string>('ANALYTICS_IP_SALT') ?? 'tzj-analytics-default';

    const siteSettings = await this.settingsService.getSitePublicSettings();
    const geoMode = siteSettings.analytics?.geoMode ?? 'ip';

    let geo = lookupGeo(ip);
    let geoSource: 'ip' | 'gps' = 'ip';

    if (geoMode === 'gps' && dto.latitude != null && dto.longitude != null) {
      const amapKey = await this.integrationsService.resolveSecret('amap', 'webKey');
      const gpsGeo = await lookupGeoFromCoordinates(dto.latitude, dto.longitude, amapKey);
      if (gpsGeo.country || gpsGeo.region || gpsGeo.city) {
        geo = gpsGeo;
        geoSource = 'gps';
      }
    }

    const referrerHost = parseReferrerHost(dto.referrer);
    const trafficSource = classifyTrafficSource({
      utmMedium: dto.utmMedium,
      utmSource: dto.utmSource,
      gclid: dto.gclid,
      referrerHost,
    });

    await this.prisma.pageView.create({
      data: {
        sessionId: dto.sessionId,
        visitorId: dto.visitorId ?? null,
        userId: dto.userId ?? null,
        path: dto.path,
        title: dto.title?.trim() || null,
        referrer: dto.referrer?.trim() || null,
        referrerHost,
        userAgent: typeof ua === 'string' ? ua.slice(0, 512) : null,
        ipHash: ip ? hashIp(ip, salt) : null,
        ip: ip ?? null,
        ipMasked: ip ? maskIp(ip) : null,
        country: geo.country,
        region: geo.region,
        city: geo.city,
        geoSource,
        deviceType: parsed.deviceType,
        deviceModel: parsed.deviceModel,
        deviceVendor: parsed.deviceVendor,
        browser: parsed.browser,
        browserVersion: parsed.browserVersion,
        os: parsed.os,
        osVersion: parsed.osVersion,
        clientApp: parsed.clientApp,
        utmSource: nullableTrim(dto.utmSource),
        utmMedium: nullableTrim(dto.utmMedium),
        utmCampaign: nullableTrim(dto.utmCampaign),
        utmContent: nullableTrim(dto.utmContent),
        utmTerm: nullableTrim(dto.utmTerm),
        gclid: nullableTrim(dto.gclid),
        trafficSource,
        isBot: parsed.isBot,
      },
    });

    return { ok: true };
  }

  async getOverview(from?: string, to?: string, granularity?: string) {
    const range = parseRange(from, to);
    const where = humanWhere(range);
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    // 时间粒度：后端为权威，非法/缺省回落自动默认；date_trunc 单位由此值驱动。
    const bucketUnit = resolveGranularity(granularity, range);

    const [
      pageViews,
      uniqueRaw,
      pageViewsToday,
      uniqueTodayRaw,
      dailyRaw,
      topPagesRaw,
      topReferrersRaw,
      topRegionsRaw,
      devicesRaw,
      browsersRaw,
      browserVersionsRaw,
    ] = await Promise.all([
      this.prisma.pageView.count({ where }),
      this.prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(DISTINCT COALESCE("visitorId", "sessionId"))::bigint AS c
        FROM "page_views"
        WHERE "isBot" = false
          AND "createdAt" >= ${range.from}
          AND "createdAt" <= ${range.to}
      `,
      this.prisma.pageView.count({
        where: { ...where, createdAt: { gte: todayStart, lte: todayEnd } },
      }),
      this.prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(DISTINCT COALESCE("visitorId", "sessionId"))::bigint AS c
        FROM "page_views"
        WHERE "isBot" = false
          AND "createdAt" >= ${todayStart}
          AND "createdAt" <= ${todayEnd}
      `,
      this.prisma.$queryRaw<Array<{ bucket: Date; pageViews: bigint; uniqueVisitors: bigint }>>`
        SELECT
          date_trunc(${bucketUnit}, "createdAt") AS bucket,
          COUNT(*)::bigint AS "pageViews",
          COUNT(DISTINCT COALESCE("visitorId", "sessionId"))::bigint AS "uniqueVisitors"
        FROM "page_views"
        WHERE "isBot" = false
          AND "createdAt" >= ${range.from}
          AND "createdAt" <= ${range.to}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      this.prisma.pageView.groupBy({
        by: ['path'],
        where,
        _count: { _all: true },
        orderBy: { _count: { path: 'desc' } },
        take: 10,
      }),
      this.prisma.$queryRaw<
        Array<{
          referrerHost: string | null;
          country: string | null;
          region: string | null;
          city: string | null;
          geoSource: string | null;
          pageViews: bigint;
        }>
      >`
        SELECT
          "referrerHost",
          country,
          region,
          city,
          "geoSource",
          COUNT(*)::bigint AS "pageViews"
        FROM "page_views"
        WHERE "isBot" = false
          AND "referrerHost" IS NOT NULL
          AND "createdAt" >= ${range.from}
          AND "createdAt" <= ${range.to}
        GROUP BY "referrerHost", country, region, city, "geoSource"
        ORDER BY "pageViews" DESC
        LIMIT 15
      `,
      this.prisma.$queryRaw<
        Array<{
          country: string | null;
          region: string | null;
          city: string | null;
          geoSource: string | null;
          pageViews: bigint;
          uniqueVisitors: bigint;
        }>
      >`
        SELECT
          country,
          region,
          city,
          "geoSource",
          COUNT(*)::bigint AS "pageViews",
          COUNT(DISTINCT COALESCE("visitorId", "sessionId"))::bigint AS "uniqueVisitors"
        FROM "page_views"
        WHERE "isBot" = false
          AND "createdAt" >= ${range.from}
          AND "createdAt" <= ${range.to}
        GROUP BY country, region, city, "geoSource"
        ORDER BY "pageViews" DESC
        LIMIT 12
      `,
      this.prisma.pageView.groupBy({
        by: ['deviceType'],
        where,
        _count: { _all: true },
        orderBy: { _count: { deviceType: 'desc' } },
      }),
      this.prisma.pageView.groupBy({
        by: ['browser'],
        where,
        _count: { _all: true },
        orderBy: { _count: { browser: 'desc' } },
        take: 8,
      }),
      // 版本级明细：供前端按「兼容性基线」离线归类（不在后端硬编码支持矩阵，避免与
      // 前台探针 / 访客表格「兼容性」列口径漂移；分类逻辑统一在 admin 端 browser-support）。
      this.prisma.pageView.groupBy({
        by: ['browser', 'browserVersion'],
        where,
        _count: { _all: true },
        orderBy: { _count: { browser: 'desc' } },
      }),
    ]);

    const topPaths = topPagesRaw.map((r) => r.path);
    const titles = topPaths.length
      ? await this.prisma.pageView.findMany({
          where: { path: { in: topPaths }, title: { not: null } },
          select: { path: true, title: true },
          orderBy: { createdAt: 'desc' },
          distinct: ['path'],
        })
      : [];
    const titleMap = new Map(titles.map((t) => [t.path, t.title]));

    const topPagesUv = await Promise.all(
      topPagesRaw.map(async (row) => {
        const uv = await this.prisma.$queryRaw<Array<{ c: bigint }>>`
          SELECT COUNT(DISTINCT COALESCE("visitorId", "sessionId"))::bigint AS c
          FROM "page_views"
          WHERE "isBot" = false
            AND "createdAt" >= ${range.from}
            AND "createdAt" <= ${range.to}
            AND "path" = ${row.path}
        `;
        return {
          path: row.path,
          title: titleMap.get(row.path) ?? null,
          pageViews: row._count._all,
          uniqueVisitors: Number(uv[0]?.c ?? 0),
        };
      }),
    );

    // 补零：按粒度枚举区间内所有桶，无数据的桶填 0，避免趋势线抖动/断裂（日期为桶起点 ISO）。
    const bucketMap = new Map(dailyRaw.map((row) => [row.bucket.toISOString(), row]));
    const daily = enumerateBuckets(range, bucketUnit).map((b) => {
      const hit = bucketMap.get(b.toISOString());
      return {
        date: b.toISOString(),
        pageViews: hit ? Number(hit.pageViews) : 0,
        uniqueVisitors: hit ? Number(hit.uniqueVisitors) : 0,
      };
    });

    return {
      // 回传实际采用的粒度（可能因非法/缺省被回落），供前端标轴与控件高亮。
      granularity: bucketUnit,
      summary: {
        pageViews,
        uniqueVisitors: Number(uniqueRaw[0]?.c ?? 0),
        pageViewsToday,
        uniqueVisitorsToday: Number(uniqueTodayRaw[0]?.c ?? 0),
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      daily,
      topPages: topPagesUv,
      topReferrers: topReferrersRaw.map((row) => ({
        referrerHost: row.referrerHost ?? '—',
        region: formatGeoLabel({
          country: row.country,
          region: row.region,
          city: row.city,
        }),
        geoSource: formatGeoSource(row.geoSource),
        pageViews: Number(row.pageViews),
      })),
      topRegions: topRegionsRaw.map((row) => ({
        region: formatGeoLabel({
          country: row.country,
          region: row.region,
          city: row.city,
        }),
        geoSource: formatGeoSource(row.geoSource),
        pageViews: Number(row.pageViews),
        uniqueVisitors: Number(row.uniqueVisitors),
      })),
      devices: devicesRaw.map((row) => ({
        deviceType: row.deviceType ?? 'unknown',
        count: row._count._all,
      })),
      browsers: browsersRaw.map((row) => ({
        browser: row.browser ?? 'Other',
        count: row._count._all,
      })),
      browserVersions: browserVersionsRaw.map((row) => ({
        browser: row.browser ?? 'Other',
        browserVersion: row.browserVersion ?? null,
        count: row._count._all,
      })),
    };
  }

  // 营销归因：渠道分组 + 广告系列 + 来源排行（均滤 bot，UV 用 visitor/session 去重）
  async getSources(from?: string, to?: string) {
    const range = parseRange(from, to);

    const [channelsRaw, campaignsRaw, sourcesRaw] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{ source: string | null; pageViews: bigint; uniqueVisitors: bigint }>
      >`
        SELECT
          COALESCE("trafficSource", 'other') AS source,
          COUNT(*)::bigint AS "pageViews",
          COUNT(DISTINCT COALESCE("visitorId", "sessionId"))::bigint AS "uniqueVisitors"
        FROM "page_views"
        WHERE "isBot" = false
          AND "createdAt" >= ${range.from}
          AND "createdAt" <= ${range.to}
        GROUP BY COALESCE("trafficSource", 'other')
        ORDER BY "pageViews" DESC
      `,
      this.prisma.$queryRaw<
        Array<{
          campaign: string;
          source: string | null;
          medium: string | null;
          pageViews: bigint;
          uniqueVisitors: bigint;
        }>
      >`
        SELECT
          "utmCampaign" AS campaign,
          "utmSource" AS source,
          "utmMedium" AS medium,
          COUNT(*)::bigint AS "pageViews",
          COUNT(DISTINCT COALESCE("visitorId", "sessionId"))::bigint AS "uniqueVisitors"
        FROM "page_views"
        WHERE "isBot" = false
          AND "utmCampaign" IS NOT NULL
          AND "createdAt" >= ${range.from}
          AND "createdAt" <= ${range.to}
        GROUP BY "utmCampaign", "utmSource", "utmMedium"
        ORDER BY "pageViews" DESC
        LIMIT 15
      `,
      this.prisma.$queryRaw<Array<{ source: string; pageViews: bigint; uniqueVisitors: bigint }>>`
        SELECT
          "utmSource" AS source,
          COUNT(*)::bigint AS "pageViews",
          COUNT(DISTINCT COALESCE("visitorId", "sessionId"))::bigint AS "uniqueVisitors"
        FROM "page_views"
        WHERE "isBot" = false
          AND "utmSource" IS NOT NULL
          AND "createdAt" >= ${range.from}
          AND "createdAt" <= ${range.to}
        GROUP BY "utmSource"
        ORDER BY "pageViews" DESC
        LIMIT 10
      `,
    ]);

    return {
      channels: channelsRaw.map((row) => ({
        source: row.source ?? 'other',
        pageViews: Number(row.pageViews),
        uniqueVisitors: Number(row.uniqueVisitors),
      })),
      topCampaigns: campaignsRaw.map((row) => ({
        campaign: row.campaign,
        source: row.source ?? '—',
        medium: row.medium ?? '—',
        pageViews: Number(row.pageViews),
        uniqueVisitors: Number(row.uniqueVisitors),
      })),
      topSources: sourcesRaw.map((row) => ({
        source: row.source,
        pageViews: Number(row.pageViews),
        uniqueVisitors: Number(row.uniqueVisitors),
      })),
    };
  }

  async listPages(params: AnalyticsListParams) {
    const { page, limit, from, to, sortBy, sortOrder } = params;
    const range = parseRange(from, to);
    const skip = (page - 1) * limit;
    const order = pageOrderClause(sortBy, sortOrder);

    const [countRow, rows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM (
          SELECT path FROM "page_views"
          WHERE "isBot" = false
            AND "createdAt" >= ${range.from}
            AND "createdAt" <= ${range.to}
          GROUP BY path
        ) grouped
      `,
      this.prisma.$queryRaw<
        Array<{
          path: string;
          title: string | null;
          pageViews: bigint;
          uniqueVisitors: bigint;
        }>
      >`
        WITH grouped AS (
          SELECT
            path,
            (ARRAY_AGG(title ORDER BY "createdAt" DESC) FILTER (WHERE title IS NOT NULL))[1] AS title,
            COUNT(*)::bigint AS "pageViews",
            COUNT(DISTINCT "sessionId")::bigint AS "uniqueVisitors"
          FROM "page_views"
          WHERE "isBot" = false
            AND "createdAt" >= ${range.from}
            AND "createdAt" <= ${range.to}
          GROUP BY path
        )
        SELECT path, title, "pageViews", "uniqueVisitors"
        FROM grouped
        ORDER BY ${order}
        LIMIT ${limit} OFFSET ${skip}
      `,
    ]);

    const total = Number(countRow[0]?.count ?? 0);

    return {
      data: rows.map((row) => ({
        id: row.path,
        path: row.path,
        title: row.title,
        pageViews: Number(row.pageViews),
        uniqueVisitors: Number(row.uniqueVisitors),
      })),
      pagination: paginateMeta(page, limit, total),
    };
  }

  async listRegions(params: AnalyticsListParams) {
    const { page, limit, from, to, sortBy, sortOrder } = params;
    const range = parseRange(from, to);
    const skip = (page - 1) * limit;
    const order = regionOrderClause(sortBy, sortOrder);

    const [countRow, rows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM (
          SELECT country, region, city, "geoSource" FROM "page_views"
          WHERE "isBot" = false
            AND "createdAt" >= ${range.from}
            AND "createdAt" <= ${range.to}
          GROUP BY country, region, city, "geoSource"
        ) grouped
      `,
      this.prisma.$queryRaw<
        Array<{
          country: string | null;
          region: string | null;
          city: string | null;
          geoSource: string | null;
          pageViews: bigint;
          uniqueVisitors: bigint;
        }>
      >`
        WITH grouped AS (
          SELECT
            country,
            region,
            city,
            "geoSource",
            COUNT(*)::bigint AS "pageViews",
            COUNT(DISTINCT "sessionId")::bigint AS "uniqueVisitors"
          FROM "page_views"
          WHERE "isBot" = false
            AND "createdAt" >= ${range.from}
            AND "createdAt" <= ${range.to}
          GROUP BY country, region, city, "geoSource"
        )
        SELECT country, region, city, "geoSource", "pageViews", "uniqueVisitors"
        FROM grouped
        ORDER BY ${order}
        LIMIT ${limit} OFFSET ${skip}
      `,
    ]);

    const total = Number(countRow[0]?.count ?? 0);

    return {
      data: rows.map((row, i) => ({
        id: `${row.country ?? ''}-${row.region ?? ''}-${row.city ?? ''}-${row.geoSource ?? ''}-${i}`,
        region: formatGeoLabel({
          country: row.country,
          region: row.region,
          city: row.city,
        }),
        geoSource: formatGeoSource(row.geoSource),
        pageViews: Number(row.pageViews),
        uniqueVisitors: Number(row.uniqueVisitors),
      })),
      pagination: paginateMeta(page, limit, total),
    };
  }

  async listReferrers(params: AnalyticsListParams) {
    const { page, limit, from, to, sortBy, sortOrder } = params;
    const range = parseRange(from, to);
    const skip = (page - 1) * limit;
    const order = referrerOrderClause(sortBy, sortOrder);

    const [countRow, rows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM (
          SELECT "referrerHost", country, region, city, "geoSource" FROM "page_views"
          WHERE "isBot" = false
            AND "referrerHost" IS NOT NULL
            AND "createdAt" >= ${range.from}
            AND "createdAt" <= ${range.to}
          GROUP BY "referrerHost", country, region, city, "geoSource"
        ) grouped
      `,
      this.prisma.$queryRaw<
        Array<{
          referrerHost: string | null;
          country: string | null;
          region: string | null;
          city: string | null;
          geoSource: string | null;
          pageViews: bigint;
        }>
      >`
        WITH grouped AS (
          SELECT
            "referrerHost",
            country,
            region,
            city,
            "geoSource",
            COUNT(*)::bigint AS "pageViews"
          FROM "page_views"
          WHERE "isBot" = false
            AND "referrerHost" IS NOT NULL
            AND "createdAt" >= ${range.from}
            AND "createdAt" <= ${range.to}
          GROUP BY "referrerHost", country, region, city, "geoSource"
        )
        SELECT "referrerHost", country, region, city, "geoSource", "pageViews"
        FROM grouped
        ORDER BY ${order}
        LIMIT ${limit} OFFSET ${skip}
      `,
    ]);

    const total = Number(countRow[0]?.count ?? 0);

    return {
      data: rows.map((row, i) => ({
        id: `${row.referrerHost ?? ''}-${row.country ?? ''}-${row.region ?? ''}-${row.geoSource ?? ''}-${i}`,
        referrerHost: row.referrerHost ?? '—',
        region: formatGeoLabel({
          country: row.country,
          region: row.region,
          city: row.city,
        }),
        geoSource: formatGeoSource(row.geoSource),
        pageViews: Number(row.pageViews),
      })),
      pagination: paginateMeta(page, limit, total),
    };
  }

  /**
   * 按 IP 聚合的「访客明细」统一列表（合并原地区/IP/来源三张表）。
   * - 每行 = 一个访客 IP；地区、定位依据、流量来源作为该 IP 的属性聚合
   * - 地区在「读取时重新解析」：优先用 IpLocationService（纯真库+在线补充）对原始 IP
   *   重解析，历史数据也能显示更精确地区；GPS 采集的行沿用入库时的 GPS 地区
   * - 缓存由 IpLocationService 负责，整页 IP 并行解析
   */
  async listVisitorDetails(params: AnalyticsListParams) {
    const { page, limit, from, to, sortBy, sortOrder } = params;
    const range = parseRange(from, to);
    const skip = (page - 1) * limit;
    const order = visitorDetailOrderClause(sortBy, sortOrder);
    // 全文检索在 grouped CTE 内按行过滤；渠道/设备按聚合代表值在 grouped 之外过滤。
    const search = ipDetailSearchSql(params.q);
    const groupWhere = ipDetailGroupWhereSql(params);

    const rows = await this.prisma.$queryRaw<
      Array<{
        ipHash: string;
        _total: bigint;
        ip: string | null;
        ipMasked: string | null;
        country: string | null;
        region: string | null;
        city: string | null;
        geoSource: string | null;
        referrerHost: string | null;
        deviceType: string | null;
        deviceModel: string | null;
        deviceVendor: string | null;
        browser: string | null;
        browserVersion: string | null;
        os: string | null;
        osVersion: string | null;
        clientApp: string | null;
        trafficSource: string | null;
        utmSource: string | null;
        utmMedium: string | null;
        landingPath: string | null;
        pageViews: bigint;
        sessions: bigint;
        firstSeenAt: Date;
        lastSeenAt: Date;
      }>
    >`
        WITH grouped AS (
          SELECT
            "ipHash",
            (ARRAY_AGG(ip ORDER BY "createdAt" DESC) FILTER (WHERE ip IS NOT NULL))[1] AS ip,
            (ARRAY_AGG("ipMasked" ORDER BY "createdAt" DESC) FILTER (WHERE "ipMasked" IS NOT NULL))[1] AS "ipMasked",
            (ARRAY_AGG(country ORDER BY "createdAt" DESC) FILTER (WHERE country IS NOT NULL))[1] AS country,
            (ARRAY_AGG(region ORDER BY "createdAt" DESC) FILTER (WHERE region IS NOT NULL))[1] AS region,
            (ARRAY_AGG(city ORDER BY "createdAt" DESC) FILTER (WHERE city IS NOT NULL))[1] AS city,
            (ARRAY_AGG("geoSource" ORDER BY "createdAt" DESC) FILTER (WHERE "geoSource" IS NOT NULL))[1] AS "geoSource",
            -- 设备取最近一次（同一 IP 可能换设备，展示当前使用的更直观）
            (ARRAY_AGG("deviceType" ORDER BY "createdAt" DESC) FILTER (WHERE "deviceType" IS NOT NULL))[1] AS "deviceType",
            (ARRAY_AGG("deviceModel" ORDER BY "createdAt" DESC) FILTER (WHERE "deviceModel" IS NOT NULL))[1] AS "deviceModel",
            (ARRAY_AGG("deviceVendor" ORDER BY "createdAt" DESC) FILTER (WHERE "deviceVendor" IS NOT NULL))[1] AS "deviceVendor",
            (ARRAY_AGG(browser ORDER BY "createdAt" DESC) FILTER (WHERE browser IS NOT NULL))[1] AS browser,
            (ARRAY_AGG("browserVersion" ORDER BY "createdAt" DESC) FILTER (WHERE "browserVersion" IS NOT NULL))[1] AS "browserVersion",
            (ARRAY_AGG(os ORDER BY "createdAt" DESC) FILTER (WHERE os IS NOT NULL))[1] AS os,
            (ARRAY_AGG("osVersion" ORDER BY "createdAt" DESC) FILTER (WHERE "osVersion" IS NOT NULL))[1] AS "osVersion",
            (ARRAY_AGG("clientApp" ORDER BY "createdAt" DESC) FILTER (WHERE "clientApp" IS NOT NULL))[1] AS "clientApp",
            -- 渠道/来源/落地页取最早一次（首触归因，反映获客入口）
            (ARRAY_AGG("referrerHost" ORDER BY "createdAt" ASC) FILTER (WHERE "referrerHost" IS NOT NULL))[1] AS "referrerHost",
            (ARRAY_AGG("trafficSource" ORDER BY "createdAt" ASC) FILTER (WHERE "trafficSource" IS NOT NULL))[1] AS "trafficSource",
            (ARRAY_AGG("utmSource" ORDER BY "createdAt" ASC) FILTER (WHERE "utmSource" IS NOT NULL))[1] AS "utmSource",
            (ARRAY_AGG("utmMedium" ORDER BY "createdAt" ASC) FILTER (WHERE "utmMedium" IS NOT NULL))[1] AS "utmMedium",
            (ARRAY_AGG(path ORDER BY "createdAt" ASC) FILTER (WHERE path IS NOT NULL))[1] AS "landingPath",
            COUNT(*)::bigint AS "pageViews",
            COUNT(DISTINCT "sessionId")::bigint AS "sessions",
            MIN("createdAt") AS "firstSeenAt",
            MAX("createdAt") AS "lastSeenAt"
          FROM "page_views"
          WHERE "isBot" = false
            AND "ipHash" IS NOT NULL
            AND "createdAt" >= ${range.from}
            AND "createdAt" <= ${range.to}
            ${search}
          GROUP BY "ipHash"
        )
        SELECT "ipHash", ip, "ipMasked", country, region, city, "geoSource", "referrerHost",
               "deviceType", "deviceModel", "deviceVendor", browser, "browserVersion", os, "osVersion", "clientApp",
               "trafficSource", "utmSource", "utmMedium", "landingPath",
               "pageViews", "sessions", "firstSeenAt", "lastSeenAt",
               COUNT(*) OVER()::bigint AS "_total"
        FROM grouped
        ${groupWhere}
        ORDER BY ${order}
        LIMIT ${limit} OFFSET ${skip}
      `;

    const total = Number(rows[0]?._total ?? 0);

    const data = await Promise.all(
      rows.map(async (row) => {
        const geo = await this.resolveVisitorDetailGeo(row);
        return {
          id: row.ipHash,
          ip: row.ip,
          ipMasked: row.ipMasked,
          region: geo.region,
          isp: geo.isp,
          geoSource: geo.geoSource,
          referrerHost: row.referrerHost ?? '—',
          channel: row.trafficSource ?? null,
          source: row.utmSource ?? null,
          medium: row.utmMedium ?? null,
          deviceType: row.deviceType ?? null,
          deviceModel: row.deviceModel ?? null,
          deviceVendor: row.deviceVendor ?? null,
          browser: row.browser ?? null,
          browserVersion: row.browserVersion ?? null,
          os: row.os ?? null,
          osVersion: row.osVersion ?? null,
          clientApp: row.clientApp ?? null,
          landingPath: row.landingPath ?? null,
          pageViews: Number(row.pageViews),
          sessions: Number(row.sessions),
          firstSeenAt: row.firstSeenAt.toISOString(),
          lastSeenAt: row.lastSeenAt.toISOString(),
        };
      }),
    );

    return {
      data,
      pagination: paginateMeta(page, limit, total),
    };
  }

  /**
   * 单行 IP 访客明细的地区/来源/ISP 解析：GPS 行沿用入库值（更权威），
   * 其余按 IP 读取时重解析（纯真库+在线补充）。抽出以收敛 map 回调复杂度。
   */
  private async resolveVisitorDetailGeo(row: {
    geoSource: string | null;
    ip: string | null;
    country: string | null;
    region: string | null;
    city: string | null;
  }): Promise<{ region: string; geoSource: string; isp: string | null }> {
    const useGps = row.geoSource === 'gps';
    const resolved = useGps ? null : await this.ipLocation.resolve(row.ip);
    const region = resolved?.location
      ? resolved.location
      : formatGeoLabel({ country: row.country, region: row.region, city: row.city });
    return {
      region,
      isp: resolved?.isp?.trim() ? resolved.isp.trim() : null,
      geoSource: useGps ? 'GPS' : resolved ? 'IP' : formatGeoSource(row.geoSource),
    };
  }

  /**
   * identify 升级：将匿名访客关联到已知身份。
   * - upsert 到 visitors 表（按 anonymousId）
   * - 回写该 visitorId 历史页面浏览的 userId，便于 B 端按身份归并
   */
  async identify(dto: {
    visitorId: string;
    userId?: string;
    email?: string;
    name?: string;
    phone?: string;
    company?: string;
    traits?: Record<string, unknown>;
  }) {
    const identified = Boolean(dto.userId || dto.email || dto.name || dto.phone);
    const updateData: Prisma.VisitorUpdateInput = {};
    if (dto.userId) updateData.userId = dto.userId;
    if (dto.email) updateData.email = dto.email;
    if (dto.name) updateData.name = dto.name;
    if (dto.phone) updateData.phone = dto.phone;
    if (dto.company) updateData.company = dto.company;
    if (dto.traits) updateData.traits = dto.traits as Prisma.InputJsonValue;
    if (identified) updateData.identifiedAt = new Date();

    await this.prisma.visitor.upsert({
      where: { anonymousId: dto.visitorId },
      create: {
        anonymousId: dto.visitorId,
        userId: dto.userId ?? null,
        email: dto.email ?? null,
        name: dto.name ?? null,
        phone: dto.phone ?? null,
        company: dto.company ?? null,
        traits: (dto.traits ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        identifiedAt: identified ? new Date() : null,
      },
      update: updateData,
    });

    if (dto.userId) {
      await this.prisma.pageView.updateMany({
        where: { visitorId: dto.visitorId, userId: null },
        data: { userId: dto.userId },
      });
    }

    return { ok: true };
  }

  /**
   * B 端「访客会话」归并列表：
   * 同一 visitorId（或已识别 userId）的多次会话合并为一行，
   * 并关联 visitors 表的身份资料（姓名/邮箱/电话/公司）。
   */
  async listVisitors(params: AnalyticsListParams) {
    const { page, limit, from, to, sortBy, sortOrder } = params;
    const range = parseRange(from, to);
    const skip = (page - 1) * limit;
    const order = visitorOrderClause(sortBy, sortOrder);
    // 行级过滤（身份 + 全文检索）拼进 base CTE 的 WHERE；
    // 渠道/设备/关键页按聚合代表值在 grouped 之外过滤（与前端展示一致）。
    const baseFilter = visitorBaseFilterSql(params);
    const groupWhere = visitorGroupWhereSql(params);

    const rows = await this.prisma.$queryRaw<
      Array<{
        mergeKey: string;
        _total: bigint;
        visitorId: string | null;
        pageViews: bigint;
        sessions: bigint;
        firstSeenAt: Date;
        lastSeenAt: Date;
        landingPath: string | null;
        deviceType: string | null;
        country: string | null;
        channel: string | null;
        browser: string | null;
        browserVersion: string | null;
        os: string | null;
        osVersion: string | null;
        deviceModel: string | null;
        deviceVendor: string | null;
        clientApp: string | null;
        region: string | null;
        city: string | null;
        lastIp: string | null;
        lastIpMasked: string | null;
        lastIpHash: string | null;
        referrerHost: string | null;
        utmSource: string | null;
        utmMedium: string | null;
        utmCampaign: string | null;
        utmContent: string | null;
        utmTerm: string | null;
        gclid: string | null;
        touchedContact: boolean | null;
        touchedCase: boolean | null;
        userId: string | null;
        email: string | null;
        name: string | null;
        phone: string | null;
        company: string | null;
        identifiedAt: Date | null;
      }>
    >`
      WITH base AS (
        -- base：逐行明细（含身份关联 + 行级过滤），grouped 归并后再按代表值过滤 + 窗口计数
        SELECT
          COALESCE(pv."userId", pv."visitorId") AS "mergeKey",
          pv."visitorId",
          pv."sessionId",
          pv."createdAt",
          pv."path",
          pv."deviceType",
          pv."country",
          pv."region",
          pv."city",
          pv."browser",
          pv."browserVersion",
          pv."os",
          pv."osVersion",
          pv."deviceModel",
          pv."deviceVendor",
          pv."clientApp",
          pv."referrerHost",
          pv."trafficSource",
          pv."utmSource",
          pv."utmMedium",
          pv."utmCampaign",
          pv."utmContent",
          pv."utmTerm",
          pv."gclid",
          pv."ip",
          pv."ipMasked",
          pv."ipHash",
          pv."userId",
          v."email",
          v."name",
          v."phone",
          v."company",
          v."identifiedAt"
        FROM "page_views" pv
        LEFT JOIN "visitors" v ON v."anonymousId" = pv."visitorId"
        WHERE pv."isBot" = false
          AND pv."visitorId" IS NOT NULL
          AND pv."createdAt" >= ${range.from}
          AND pv."createdAt" <= ${range.to}
          ${baseFilter}
      ),
      grouped AS (
        SELECT
        "mergeKey",
        (ARRAY_AGG("visitorId" ORDER BY "createdAt" DESC) FILTER (WHERE "visitorId" IS NOT NULL))[1] AS "visitorId",
        COUNT(*)::bigint AS "pageViews",
        COUNT(DISTINCT "sessionId")::bigint AS "sessions",
        MIN("createdAt") AS "firstSeenAt",
        MAX("createdAt") AS "lastSeenAt",
        (ARRAY_AGG("path" ORDER BY "createdAt" ASC) FILTER (WHERE "path" IS NOT NULL))[1] AS "landingPath",
        (ARRAY_AGG("deviceType" ORDER BY "createdAt" DESC) FILTER (WHERE "deviceType" IS NOT NULL))[1] AS "deviceType",
        (ARRAY_AGG("country" ORDER BY "createdAt" DESC) FILTER (WHERE "country" IS NOT NULL))[1] AS "country",
        (ARRAY_AGG("trafficSource" ORDER BY "createdAt" ASC) FILTER (WHERE "trafficSource" IS NOT NULL))[1] AS "channel",
        (ARRAY_AGG("browser" ORDER BY "createdAt" DESC) FILTER (WHERE "browser" IS NOT NULL))[1] AS "browser",
        (ARRAY_AGG("browserVersion" ORDER BY "createdAt" DESC) FILTER (WHERE "browserVersion" IS NOT NULL))[1] AS "browserVersion",
        (ARRAY_AGG("os" ORDER BY "createdAt" DESC) FILTER (WHERE "os" IS NOT NULL))[1] AS "os",
        (ARRAY_AGG("osVersion" ORDER BY "createdAt" DESC) FILTER (WHERE "osVersion" IS NOT NULL))[1] AS "osVersion",
        (ARRAY_AGG("deviceModel" ORDER BY "createdAt" DESC) FILTER (WHERE "deviceModel" IS NOT NULL))[1] AS "deviceModel",
        (ARRAY_AGG("deviceVendor" ORDER BY "createdAt" DESC) FILTER (WHERE "deviceVendor" IS NOT NULL))[1] AS "deviceVendor",
        (ARRAY_AGG("clientApp" ORDER BY "createdAt" DESC) FILTER (WHERE "clientApp" IS NOT NULL))[1] AS "clientApp",
        (ARRAY_AGG("region" ORDER BY "createdAt" DESC) FILTER (WHERE "region" IS NOT NULL))[1] AS "region",
        (ARRAY_AGG("city" ORDER BY "createdAt" DESC) FILTER (WHERE "city" IS NOT NULL))[1] AS "city",
        -- 最后一次访问的 IP（环境维度：展示/复制/下钻 IP 抽屉，非身份标识）
        (ARRAY_AGG("ip" ORDER BY "createdAt" DESC) FILTER (WHERE "ip" IS NOT NULL))[1] AS "lastIp",
        (ARRAY_AGG("ipMasked" ORDER BY "createdAt" DESC) FILTER (WHERE "ipMasked" IS NOT NULL))[1] AS "lastIpMasked",
        (ARRAY_AGG("ipHash" ORDER BY "createdAt" DESC) FILTER (WHERE "ipHash" IS NOT NULL))[1] AS "lastIpHash",
        (ARRAY_AGG("referrerHost" ORDER BY "createdAt" ASC) FILTER (WHERE "referrerHost" IS NOT NULL))[1] AS "referrerHost",
        -- 营销归因（首触）：UTM 五参数 + Google Ads 点击 ID，供导出做投放分析
        (ARRAY_AGG("utmSource" ORDER BY "createdAt" ASC) FILTER (WHERE "utmSource" IS NOT NULL))[1] AS "utmSource",
        (ARRAY_AGG("utmMedium" ORDER BY "createdAt" ASC) FILTER (WHERE "utmMedium" IS NOT NULL))[1] AS "utmMedium",
        (ARRAY_AGG("utmCampaign" ORDER BY "createdAt" ASC) FILTER (WHERE "utmCampaign" IS NOT NULL))[1] AS "utmCampaign",
        (ARRAY_AGG("utmContent" ORDER BY "createdAt" ASC) FILTER (WHERE "utmContent" IS NOT NULL))[1] AS "utmContent",
        (ARRAY_AGG("utmTerm" ORDER BY "createdAt" ASC) FILTER (WHERE "utmTerm" IS NOT NULL))[1] AS "utmTerm",
        (ARRAY_AGG("gclid" ORDER BY "createdAt" ASC) FILTER (WHERE "gclid" IS NOT NULL))[1] AS "gclid",
        ${keyPageTouchedSql(CONTACT_PATH_SEGMENTS)} AS "touchedContact",
        ${keyPageTouchedSql(CASE_PATH_SEGMENTS)} AS "touchedCase",
        (ARRAY_AGG("userId" ORDER BY "createdAt" DESC) FILTER (WHERE "userId" IS NOT NULL))[1] AS "userId",
        (ARRAY_AGG("email" ORDER BY "createdAt" DESC) FILTER (WHERE "email" IS NOT NULL))[1] AS "email",
        (ARRAY_AGG("name" ORDER BY "createdAt" DESC) FILTER (WHERE "name" IS NOT NULL))[1] AS "name",
        (ARRAY_AGG("phone" ORDER BY "createdAt" DESC) FILTER (WHERE "phone" IS NOT NULL))[1] AS "phone",
        (ARRAY_AGG("company" ORDER BY "createdAt" DESC) FILTER (WHERE "company" IS NOT NULL))[1] AS "company",
        (ARRAY_AGG("identifiedAt" ORDER BY "createdAt" DESC) FILTER (WHERE "identifiedAt" IS NOT NULL))[1] AS "identifiedAt"
      FROM base
      GROUP BY "mergeKey"
      ),
      flagged AS (
        -- flagged：在归并行上附人物级转化旗标（口径同 loadVisitorLeadStatuses），供筛选/排序在分页前生效
        SELECT grouped.*, ${visitorConvertedFlagSql()} AS "converted"
        FROM grouped
      )
      SELECT flagged.*, COUNT(*) OVER()::bigint AS "_total"
      FROM flagged
      ${groupWhere}
      ORDER BY ${order}
      LIMIT ${limit} OFFSET ${skip}
    `;

    const total = Number(rows[0]?._total ?? 0);

    // 人物级转化状态（转化去重锚点 + 已转客户徽标）：仅对当页行做两次精确 in 反查
    const leadByKey = await this.loadVisitorLeadStatuses(
      rows.map((row) => ({
        id: row.mergeKey,
        visitorId: row.visitorId ?? row.mergeKey,
        userId: row.userId,
        email: row.email,
      })),
    );

    return {
      data: rows.map((row) => ({
        id: row.mergeKey,
        visitorId: row.visitorId ?? row.mergeKey,
        // 以下可空字段原始 SQL 已返回 string | null，无需再 ?? null（避免抬高圈复杂度）
        userId: row.userId,
        name: row.name,
        email: row.email,
        phone: row.phone,
        company: row.company,
        identified: Boolean(row.identifiedAt),
        identifiedAt: row.identifiedAt?.toISOString() ?? null,
        pageViews: Number(row.pageViews),
        sessions: Number(row.sessions),
        firstSeenAt: row.firstSeenAt.toISOString(),
        lastSeenAt: row.lastSeenAt.toISOString(),
        landingPath: row.landingPath ?? '—',
        deviceType: row.deviceType ?? 'unknown',
        country: row.country ?? '—',
        channel: row.channel,
        browser: row.browser,
        browserVersion: row.browserVersion,
        os: row.os,
        osVersion: row.osVersion,
        deviceModel: row.deviceModel,
        deviceVendor: row.deviceVendor,
        clientApp: row.clientApp,
        region: row.region,
        city: row.city,
        lastIp: row.lastIp,
        lastIpMasked: row.lastIpMasked,
        lastIpHash: row.lastIpHash,
        referrerHost: row.referrerHost,
        utmSource: row.utmSource,
        utmMedium: row.utmMedium,
        utmCampaign: row.utmCampaign,
        utmContent: row.utmContent,
        utmTerm: row.utmTerm,
        gclid: row.gclid,
        touchedContact: Boolean(row.touchedContact),
        touchedCase: Boolean(row.touchedCase),
        // 人物级转化：最近一条询盘 ID（转化去重锚点）+ 已转客户 ID（列表徽标/档案链接）
        latestContactId: leadByKey.get(row.mergeKey)?.latestContactId ?? null,
        convertedCustomerId: leadByKey.get(row.mergeKey)?.convertedCustomerId ?? null,
      })),
      pagination: paginateMeta(page, limit, total),
    };
  }

  /**
   * 人物级转化状态批量版（口径同 resolveVisitorLeadStatus，供列表附带）：
   * 询盘链路按 id（identify 回写 userId=contactId）/ visitorId 锚定 / email 三路合并反查，
   * 已转客户按 Customer.contactId / Customer.visitorId 任一命中；共两次精确 in 查询。
   */
  private async loadVisitorLeadStatuses(
    rows: Array<{ id: string; visitorId: string; userId: string | null; email: string | null }>,
  ): Promise<Map<string, { latestContactId: string | null; convertedCustomerId: string | null }>> {
    const result = new Map<
      string,
      { latestContactId: string | null; convertedCustomerId: string | null }
    >();
    if (rows.length === 0) return result;
    // 访客身份键：匿名 visitorId 与识别后的 userId 均视为同一人
    const visitorKeys = [
      ...new Set(rows.flatMap((r) => [r.visitorId, r.userId]).filter((v): v is string => !!v)),
    ];
    const emails = [...new Set(rows.map((r) => r.email).filter((v): v is string => !!v))];

    const contacts = await this.prisma.contact.findMany({
      where: { OR: [{ id: { in: visitorKeys } }, ...buildContactMatchOr(visitorKeys, emails)] },
      orderBy: { createdAt: 'desc' },
      select: { id: true, visitorId: true, email: true, createdAt: true },
    });

    const customerOr: Prisma.CustomerWhereInput[] = [{ visitorId: { in: visitorKeys } }];
    if (contacts.length) customerOr.push({ contactId: { in: contacts.map((c) => c.id) } });
    const customers = await this.prisma.customer.findMany({
      where: { OR: customerOr },
      select: { id: true, contactId: true, visitorId: true },
    });

    // 建索引：身份键/邮箱 → 最近询盘；身份键/询盘键 → 已转客户；再逐行 O(1) 归因
    const contactById = new Map(contacts.map((c) => [c.id, c]));
    const latestByKey = indexLatestContactsByKey(contacts);
    const convertedByKey = indexConvertedCustomersByKey(customers, contactById);
    for (const row of rows) {
      const keys = [row.visitorId, row.userId, row.email].filter((v): v is string => !!v);
      result.set(row.id, resolveRowLeadStatus(keys, latestByKey, convertedByKey));
    }
    return result;
  }

  /**
   * 「按访客」lens 全量导出：复用 listVisitors 的筛选/排序，去分页（上限防超大导出），
   * 并附加转化标签（是否提交询盘 / 是否转客户 / 首访至询盘天数）供 AI 做投放与画像分析。
   * 返回带 pagination：TransformInterceptor 仅对 { data, pagination } 结构上提 data，
   * 缺了会被包成嵌套 data.data，前端 api.list 拿到的就不是数组。
   */
  async exportVisitors(params: Omit<AnalyticsListParams, 'page' | 'limit'>) {
    const { data } = await this.listVisitors({ ...params, page: 1, limit: EXPORT_MAX_ROWS });
    const conversion = await this.loadVisitorConversion(data);
    return {
      data: data.map((row) => {
        const contact =
          conversion.byVisitorId.get(row.visitorId) ??
          (row.email ? conversion.byEmail.get(row.email) : undefined);
        return {
          ...row,
          inquirySubmitted: Boolean(contact),
          inquiredAt: contact?.createdAt.toISOString() ?? null,
          // 已转客户以列表同源的 convertedCustomerId 为准（覆盖 Customer.visitorId 链路）
          convertedCustomer: Boolean(row.convertedCustomerId),
          daysToInquiry: contact ? diffDaysNonNegative(row.firstSeenAt, contact.createdAt) : null,
        };
      }),
      pagination: paginateMeta(1, EXPORT_MAX_ROWS, data.length),
    };
  }

  /**
   * 导出行的询盘反查：Contact 按 visitorId（埋点同源锚定）为主、email 为辅匹配，
   * 同一键保留最早一条（是否转客户由列表行的 convertedCustomerId 提供）。
   * 小公司量级下一次精确 in 查询即可，不做预聚合表。
   */
  private async loadVisitorConversion(rows: Array<{ visitorId: string; email: string | null }>) {
    const visitorIds = [...new Set(rows.map((r) => r.visitorId).filter(Boolean))];
    const emails = [...new Set(rows.map((r) => r.email).filter((v): v is string => Boolean(v)))];
    const or = buildContactMatchOr(visitorIds, emails);
    if (or.length === 0) {
      return {
        byVisitorId: new Map<string, ContactRef>(),
        byEmail: new Map<string, ContactRef>(),
      };
    }

    const contacts = await this.prisma.contact.findMany({
      where: { OR: or },
      select: { id: true, visitorId: true, email: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return indexEarliestContacts(contacts);
  }

  /** 「按 IP」lens 全量导出：复用 listVisitorDetails 的筛选/排序，去分页（上限防超大导出）。 */
  async exportVisitorDetails(params: Omit<AnalyticsListParams, 'page' | 'limit'>) {
    const { data } = await this.listVisitorDetails({ ...params, page: 1, limit: EXPORT_MAX_ROWS });
    // 同 exportVisitors：带 pagination 才能被拦截器上提 data，保持列表接口同构
    return { data, pagination: paginateMeta(1, EXPORT_MAX_ROWS, data.length) };
  }

  /**
   * 单个访客（按持久 visitorId 或已识别 userId）的浏览行为时间线。
   * Phase 1：仅读取已采集的 PageView，按 sessionId 分组为会话；
   * durationMs = 会话内首末 PageView 时间差（非真实停留，UI 标注「约」）。
   */
  async getVisitorActivity(visitorId: string, opts: { from?: string; to?: string }) {
    const range = parseRange(opts.from, opts.to);
    const views = await this.prisma.pageView.findMany({
      where: {
        isBot: false,
        createdAt: { gte: range.from, lte: range.to },
        OR: [{ visitorId }, { userId: visitorId }],
      },
      orderBy: { createdAt: 'asc' },
      take: 500, // 上限防超大访客
      select: {
        sessionId: true,
        path: true,
        title: true,
        createdAt: true,
        referrerHost: true,
        trafficSource: true,
        deviceType: true,
        deviceModel: true,
        deviceVendor: true,
        browser: true,
        browserVersion: true,
        os: true,
        osVersion: true,
        clientApp: true,
        region: true,
        city: true,
        country: true,
        ipHash: true,
        ipMasked: true,
        ip: true,
      },
    });

    const sessions = groupVisitorSessions(views);
    const techInfo = buildVisitorTechInfo(views);
    const networks = buildVisitorNetworks(views);
    const identity = await this.resolveVisitorIdentity(visitorId);
    const first = views[0];
    const last = views[views.length - 1];

    return {
      visitorId,
      identity,
      sessions,
      techInfo,
      networks,
      summary: {
        totalPageViews: views.length,
        totalSessions: sessions.length,
        firstSeenAt: first?.createdAt.toISOString() ?? null,
        lastSeenAt: last?.createdAt.toISOString() ?? null,
        touchedContact: views.some((v) => touchedContact(v.path)),
        touchedCase: views.some((v) => touchedCase(v.path)),
      },
    };
  }

  /**
   * 单个 IP（ipHash）的浏览行为时间线（按会话分组，读取现有 PageView）。
   * 与 getVisitorActivity 同构，供 /analytics「访客明细」（按 IP 聚合，无 visitorId）下钻使用。
   * 返回结构一致，visitorId 字段回填 ipHash 以复用前端时间线组件。
   */
  async getIpVisitorActivity(ipHash: string, opts: { from?: string; to?: string }) {
    const range = parseRange(opts.from, opts.to);
    const views = await this.prisma.pageView.findMany({
      where: {
        isBot: false,
        createdAt: { gte: range.from, lte: range.to },
        ipHash,
      },
      orderBy: { createdAt: 'asc' },
      take: 500, // 上限防超大访客
      select: {
        sessionId: true,
        path: true,
        title: true,
        createdAt: true,
        referrerHost: true,
        trafficSource: true,
        deviceType: true,
        deviceModel: true,
        deviceVendor: true,
        browser: true,
        browserVersion: true,
        os: true,
        osVersion: true,
        clientApp: true,
        region: true,
        city: true,
        country: true,
      },
    });

    const sessions = groupVisitorSessions(views);
    const techInfo = buildVisitorTechInfo(views);
    const first = views[0];
    const last = views[views.length - 1];
    const relatedVisitors = await this.getIpRelatedVisitors(ipHash, range);
    const header = await this.resolveIpHeader(ipHash, range);

    return {
      visitorId: ipHash,
      header,
      sessions,
      techInfo,
      relatedVisitors,
      summary: {
        totalPageViews: views.length,
        totalSessions: sessions.length,
        firstSeenAt: first?.createdAt.toISOString() ?? null,
        lastSeenAt: last?.createdAt.toISOString() ?? null,
        touchedContact: views.some((v) => touchedContact(v.path)),
        touchedCase: views.some((v) => touchedCase(v.path)),
      },
    };
  }

  /**
   * 同一 IP 下去重的关联访客（IP↔访客为多对多：NAT/共享网络下一个 IP 可能对应多人）。
   * 按该 IP 内浏览量倒序取 Top 20，关联 visitors 表身份，供抽屉「关联访客」桥跳转按人下钻。
   */
  private async getIpRelatedVisitors(ipHash: string, range: { from: Date; to: Date }) {
    const grouped = await this.prisma.pageView.groupBy({
      by: ['visitorId'],
      where: {
        ipHash,
        isBot: false,
        createdAt: { gte: range.from, lte: range.to },
        visitorId: { not: null },
      },
      _count: { visitorId: true },
      orderBy: { _count: { visitorId: 'desc' } },
      take: 20,
    });
    const visitorIds = grouped
      .map((g) => g.visitorId)
      .filter((v): v is string => typeof v === 'string');
    if (visitorIds.length === 0) return [];
    const metas = await this.prisma.visitor.findMany({
      where: { anonymousId: { in: visitorIds } },
    });
    const metaMap = new Map(metas.map((m) => [m.anonymousId, m]));
    return grouped
      .filter((g): g is typeof g & { visitorId: string } => typeof g.visitorId === 'string')
      .map((g) => {
        const meta = metaMap.get(g.visitorId);
        return {
          visitorId: g.visitorId,
          name: meta?.name ?? null,
          email: meta?.email ?? null,
          phone: meta?.phone ?? null,
          company: meta?.company ?? null,
          identified: Boolean(meta?.identifiedAt),
          pageViews: g._count.visitorId,
        };
      });
  }

  /** 人物抽屉头部身份：按 anonymousId 或已识别 userId 命中 visitors 表；
      字段级兜底链：前台自报(visitors) → 转化后客户档案 → 最近一条询盘表单（转化而来的访客多未自报过身份，不兜底会显示匿名）。 */
  private async resolveVisitorIdentity(visitorId: string) {
    const visitor = await this.prisma.visitor.findFirst({
      where: { OR: [{ anonymousId: visitorId }, { userId: visitorId }] },
      select: {
        name: true,
        email: true,
        phone: true,
        company: true,
        identifiedAt: true,
        userId: true,
      },
    });
    const lead = await this.resolveVisitorLeadStatus(visitorId, visitor);
    const customer = lead.customer;
    const contact = lead.latestContact;
    return {
      visitorId,
      name: visitor?.name ?? customer?.name ?? contact?.name ?? null,
      email: visitor?.email ?? customer?.email ?? contact?.email ?? null,
      phone: visitor?.phone ?? customer?.phone ?? contact?.phone ?? null,
      company: visitor?.company ?? customer?.company ?? contact?.company ?? null,
      identified: Boolean(visitor?.identifiedAt),
      // 人物级转化：最近一条询盘 contactId 作去重锚点，任一已关联 Customer 则标记已转
      latestContactId: lead.latestContactId,
      convertedCustomerId: lead.convertedCustomerId,
    };
  }

  /**
   * 人物级转化状态：覆盖询盘 contactId / 访客 visitorId 两条归因链路，
   * 任一命中已关联 Customer 即标记「已转客户」；同时返回最近一条 contactId 作转化去重锚点。
   * 纯访客/纯聊天转化（无询盘）依靠转化时回写的 visitorId 识别，避免头部误显示未转化。
   * 同时带出客户档案 / 最近询盘的联系信息，供抽屉头部身份兜底展示。
   */
  private async resolveVisitorLeadStatus(
    visitorId: string,
    visitor: { userId: string | null; email: string | null } | null,
  ) {
    // 访客身份键：匿名 ID 与识别后的 userId 均视为同一访客
    const visitorKeys = [visitorId, visitor?.userId].filter((v): v is string => !!v);
    const emails = [visitor?.email].filter((v): v is string => !!v);

    // 询盘链路：按 userId=contactId 或同 email 反解该访客的 Contact（最近一条作转化去重锚点）
    const contacts =
      visitorKeys.length || emails.length
        ? await this.prisma.contact.findMany({
            where: { OR: [{ id: { in: visitorKeys } }, { email: { in: emails } }] },
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, email: true, phone: true, company: true },
          })
        : [];
    const contactIds = contacts.map((c) => c.id);

    // 已转客户：询盘 / 访客两条归因链路任一命中即视为已转
    const orConds: Prisma.CustomerWhereInput[] = [];
    if (contactIds.length) orConds.push({ contactId: { in: contactIds } });
    if (visitorKeys.length) orConds.push({ visitorId: { in: visitorKeys } });
    const customer = orConds.length
      ? await this.prisma.customer.findFirst({
          where: { OR: orConds },
          select: { id: true, name: true, email: true, phone: true, company: true },
        })
      : null;

    return {
      latestContactId: contacts[0]?.id ?? null,
      convertedCustomerId: customer?.id ?? null,
      customer,
      latestContact: contacts[0] ?? null,
    };
  }

  /** IP 抽屉头部：取该 ipHash 最近一条代表行，按原始 IP 重解析地区/ISP（复用 resolveVisitorDetailGeo）。 */
  private async resolveIpHeader(ipHash: string, range: { from: Date; to: Date }) {
    const repr = await this.prisma.pageView.findFirst({
      where: { ipHash, isBot: false, createdAt: { gte: range.from, lte: range.to } },
      orderBy: { createdAt: 'desc' },
      select: {
        ip: true,
        ipMasked: true,
        country: true,
        region: true,
        city: true,
        geoSource: true,
      },
    });
    if (!repr) {
      return {
        ip: null,
        ipMasked: null,
        region: '未知',
        isp: null,
        geoSource: formatGeoSource(null),
      };
    }
    const geo = await this.resolveVisitorDetailGeo(repr);
    return {
      ip: repr.ip,
      ipMasked: repr.ipMasked,
      region: geo.region,
      isp: geo.isp,
      geoSource: geo.geoSource,
    };
  }

  /**
   * 按 visitorId 归并的询盘列表（人物抽屉「询盘」tab）：
   * 询盘(Contact) 经 visitors 表关联（Visitor.userId=contactId 或同 email），
   * 故先由 visitorId 反解 contactId/email，再取 contacts + 是否已转客户。
   */
  async getVisitorInquiries(visitorId: string) {
    const visitor = await this.prisma.visitor.findFirst({
      where: { OR: [{ anonymousId: visitorId }, { userId: visitorId }] },
      select: { userId: true, email: true },
    });
    const contactIds = [visitorId, visitor?.userId].filter((v): v is string => !!v);
    const emails = [visitor?.email].filter((v): v is string => !!v);
    if (contactIds.length === 0 && emails.length === 0) return { data: [] };

    const contacts = await this.prisma.contact.findMany({
      where: { OR: [{ id: { in: contactIds } }, { email: { in: emails } }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    if (contacts.length === 0) return { data: [] };

    const customers = await this.prisma.customer.findMany({
      where: { contactId: { in: contacts.map((c) => c.id) } },
      select: { id: true, contactId: true },
    });
    const customerByContact = new Map(customers.map((c) => [c.contactId, c.id]));

    return {
      data: contacts.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        company: c.company,
        subject: c.subject,
        message: c.message,
        createdAt: c.createdAt.toISOString(),
        isRead: c.isRead,
        isHandled: c.isHandled,
        convertedCustomerId: customerByContact.get(c.id) ?? null,
      })),
    };
  }
}
