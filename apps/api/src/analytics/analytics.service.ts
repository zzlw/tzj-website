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
  pageOrderClause,
  paginateMeta,
  referrerOrderClause,
  regionOrderClause,
  visitorDetailOrderClause,
} from './utils/analytics-list';
import { extractClientIp, hashIp, maskIp, parseReferrerHost } from './utils/client-ip';
import { lookupGeo } from './utils/geo-ip';
import { formatGeoLabel, formatGeoSource } from './utils/geo-label';
import { lookupGeoFromCoordinates } from './utils/geo-reverse';
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

    await this.prisma.pageView.create({
      data: {
        sessionId: dto.sessionId,
        visitorId: dto.visitorId ?? null,
        userId: dto.userId ?? null,
        path: dto.path,
        title: dto.title?.trim() || null,
        referrer: dto.referrer?.trim() || null,
        referrerHost: parseReferrerHost(dto.referrer),
        userAgent: typeof ua === 'string' ? ua.slice(0, 512) : null,
        ipHash: ip ? hashIp(ip, salt) : null,
        ip: ip ?? null,
        ipMasked: ip ? maskIp(ip) : null,
        country: geo.country,
        region: geo.region,
        city: geo.city,
        geoSource,
        deviceType: parsed.deviceType,
        browser: parsed.browser,
        os: parsed.os,
        isBot: parsed.isBot,
      },
    });

    return { ok: true };
  }

  async getOverview(from?: string, to?: string) {
    const range = parseRange(from, to);
    const where = humanWhere(range);
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

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
      this.prisma.$queryRaw<Array<{ day: Date; pageViews: bigint; uniqueVisitors: bigint }>>`
        SELECT
          DATE("createdAt") AS day,
          COUNT(*)::bigint AS "pageViews",
          COUNT(DISTINCT COALESCE("visitorId", "sessionId"))::bigint AS "uniqueVisitors"
        FROM "page_views"
        WHERE "isBot" = false
          AND "createdAt" >= ${range.from}
          AND "createdAt" <= ${range.to}
        GROUP BY DATE("createdAt")
        ORDER BY day ASC
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

    return {
      summary: {
        pageViews,
        uniqueVisitors: Number(uniqueRaw[0]?.c ?? 0),
        pageViewsToday,
        uniqueVisitorsToday: Number(uniqueTodayRaw[0]?.c ?? 0),
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      daily: dailyRaw.map((row) => ({
        date: row.day.toISOString().slice(0, 10),
        pageViews: Number(row.pageViews),
        uniqueVisitors: Number(row.uniqueVisitors),
      })),
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

    const [countRow, rows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM (
          SELECT "ipHash" FROM "page_views"
          WHERE "isBot" = false
            AND "ipHash" IS NOT NULL
            AND "createdAt" >= ${range.from}
            AND "createdAt" <= ${range.to}
          GROUP BY "ipHash"
        ) grouped
      `,
      this.prisma.$queryRaw<
        Array<{
          ipHash: string;
          ip: string | null;
          ipMasked: string | null;
          country: string | null;
          region: string | null;
          city: string | null;
          geoSource: string | null;
          referrerHost: string | null;
          pageViews: bigint;
          uniqueVisitors: bigint;
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
            (ARRAY_AGG("referrerHost" ORDER BY "createdAt" DESC) FILTER (WHERE "referrerHost" IS NOT NULL))[1] AS "referrerHost",
            COUNT(*)::bigint AS "pageViews",
            COUNT(DISTINCT "sessionId")::bigint AS "uniqueVisitors",
            MAX("createdAt") AS "lastSeenAt"
          FROM "page_views"
          WHERE "isBot" = false
            AND "ipHash" IS NOT NULL
            AND "createdAt" >= ${range.from}
            AND "createdAt" <= ${range.to}
          GROUP BY "ipHash"
        )
        SELECT "ipHash", ip, "ipMasked", country, region, city, "geoSource", "referrerHost", "pageViews", "uniqueVisitors", "lastSeenAt"
        FROM grouped
        ORDER BY ${order}
        LIMIT ${limit} OFFSET ${skip}
      `,
    ]);

    const total = Number(countRow[0]?.count ?? 0);

    const data = await Promise.all(
      rows.map(async (row) => {
        // GPS 采集的行地区更权威，沿用入库值；其余按 IP 读取时重解析（纯真库+在线补充）
        const useGps = row.geoSource === 'gps';
        const resolved = useGps ? null : await this.ipLocation.resolve(row.ip);
        const region = resolved?.location
          ? resolved.location
          : formatGeoLabel({ country: row.country, region: row.region, city: row.city });
        return {
          id: row.ipHash,
          ip: row.ip,
          ipMasked: row.ipMasked,
          region,
          isp: resolved?.isp?.trim() ? resolved.isp.trim() : null,
          geoSource: useGps ? 'GPS' : resolved ? 'IP' : formatGeoSource(row.geoSource),
          referrerHost: row.referrerHost ?? '—',
          pageViews: Number(row.pageViews),
          uniqueVisitors: Number(row.uniqueVisitors),
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
  async listVisitors(params: AnalyticsListParams & { q?: string }) {
    const { page, limit, from, to, q } = params;
    const range = parseRange(from, to);
    const skip = (page - 1) * limit;

    const countRow = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT COALESCE(pv."userId", pv."visitorId"))::bigint AS count
      FROM "page_views" pv
      LEFT JOIN "visitors" v ON v."anonymousId" = pv."visitorId"
      WHERE pv."isBot" = false
        AND pv."visitorId" IS NOT NULL
        AND pv."createdAt" >= ${range.from}
        AND pv."createdAt" <= ${range.to}
        ${q ? Prisma.sql`AND (v."email" ILIKE ${`%${q}%`} OR v."name" ILIKE ${`%${q}%`} OR v."phone" ILIKE ${`%${q}%`} OR v."company" ILIKE ${`%${q}%`})` : Prisma.sql``}
    `;

    const rows = await this.prisma.$queryRaw<
      Array<{
        mergeKey: string;
        visitorId: string | null;
        pageViews: bigint;
        sessions: bigint;
        firstSeenAt: Date;
        lastSeenAt: Date;
        landingPath: string | null;
        deviceType: string | null;
        country: string | null;
        userId: string | null;
        email: string | null;
        name: string | null;
        phone: string | null;
        company: string | null;
        identifiedAt: Date | null;
      }>
    >`
      WITH base AS (
        SELECT
          COALESCE(pv."userId", pv."visitorId") AS "mergeKey",
          pv."visitorId",
          pv."sessionId",
          pv."createdAt",
          pv."path",
          pv."deviceType",
          pv."country",
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
          ${q ? Prisma.sql`AND (v."email" ILIKE ${`%${q}%`} OR v."name" ILIKE ${`%${q}%`} OR v."phone" ILIKE ${`%${q}%`} OR v."company" ILIKE ${`%${q}%`})` : Prisma.sql``}
      )
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
        (ARRAY_AGG("userId" ORDER BY "createdAt" DESC) FILTER (WHERE "userId" IS NOT NULL))[1] AS "userId",
        (ARRAY_AGG("email" ORDER BY "createdAt" DESC) FILTER (WHERE "email" IS NOT NULL))[1] AS "email",
        (ARRAY_AGG("name" ORDER BY "createdAt" DESC) FILTER (WHERE "name" IS NOT NULL))[1] AS "name",
        (ARRAY_AGG("phone" ORDER BY "createdAt" DESC) FILTER (WHERE "phone" IS NOT NULL))[1] AS "phone",
        (ARRAY_AGG("company" ORDER BY "createdAt" DESC) FILTER (WHERE "company" IS NOT NULL))[1] AS "company",
        (ARRAY_AGG("identifiedAt" ORDER BY "createdAt" DESC) FILTER (WHERE "identifiedAt" IS NOT NULL))[1] AS "identifiedAt"
      FROM base
      GROUP BY "mergeKey"
      ORDER BY "lastSeenAt" DESC
      LIMIT ${limit} OFFSET ${skip}
    `;

    const total = Number(countRow[0]?.count ?? 0);

    return {
      data: rows.map((row) => ({
        id: row.mergeKey,
        visitorId: row.visitorId ?? row.mergeKey,
        userId: row.userId ?? null,
        name: row.name ?? null,
        email: row.email ?? null,
        phone: row.phone ?? null,
        company: row.company ?? null,
        identified: Boolean(row.identifiedAt),
        identifiedAt: row.identifiedAt?.toISOString() ?? null,
        pageViews: Number(row.pageViews),
        sessions: Number(row.sessions),
        firstSeenAt: row.firstSeenAt.toISOString(),
        lastSeenAt: row.lastSeenAt.toISOString(),
        landingPath: row.landingPath ?? '—',
        deviceType: row.deviceType ?? 'unknown',
        country: row.country ?? '—',
      })),
      pagination: paginateMeta(page, limit, total),
    };
  }
}
