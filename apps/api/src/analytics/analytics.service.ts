import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { Prisma } from "@prisma/client/index";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { IntegrationsService } from "../integrations/integrations.service";
import { IpBanService } from "../security/ip-ban.service";
import { CollectPageViewDto } from "./dto/collect-pageview.dto";
import {
  extractClientIp,
  hashIp,
  maskIp,
  parseReferrerHost,
} from "./utils/client-ip";
import { formatGeoLabel, formatGeoSource } from "./utils/geo-label";
import { lookupGeo } from "./utils/geo-ip";
import { lookupGeoFromCoordinates } from "./utils/geo-reverse";
import {
  type AnalyticsListParams,
  pageOrderClause,
  paginateMeta,
  referrerOrderClause,
  regionOrderClause,
} from "./utils/analytics-list";
import { parseUserAgent } from "./utils/ua-parser";

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
  ) {}

  async collect(dto: CollectPageViewDto, req: Request) {
    const ua = req.headers["user-agent"];
    const parsed = parseUserAgent(typeof ua === "string" ? ua : undefined);
    const ip = extractClientIp(req);

    if (ip && (await this.ipBanService.isBlocked(ip))) {
      return { ok: true };
    }

    const salt =
      this.config.get<string>("ANALYTICS_IP_SALT") ?? "tzj-analytics-default";

    const siteSettings = await this.settingsService.getSitePublicSettings();
    const geoMode = siteSettings.analytics?.geoMode ?? "ip";

    let geo = lookupGeo(ip);
    let geoSource: "ip" | "gps" = "ip";

    if (
      geoMode === "gps" &&
      dto.latitude != null &&
      dto.longitude != null
    ) {
      const amapKey = await this.integrationsService.resolveSecret("amap", "webKey");
      const gpsGeo = await lookupGeoFromCoordinates(
        dto.latitude,
        dto.longitude,
        amapKey,
      );
      if (gpsGeo.country || gpsGeo.region || gpsGeo.city) {
        geo = gpsGeo;
        geoSource = "gps";
      }
    }

    await this.prisma.pageView.create({
      data: {
        sessionId: dto.sessionId,
        path: dto.path,
        title: dto.title?.trim() || null,
        referrer: dto.referrer?.trim() || null,
        referrerHost: parseReferrerHost(dto.referrer),
        userAgent: typeof ua === "string" ? ua.slice(0, 512) : null,
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
      uniqueRows,
      pageViewsToday,
      uniqueTodayRows,
      dailyRaw,
      topPagesRaw,
      topReferrersRaw,
      topRegionsRaw,
      devicesRaw,
      browsersRaw,
    ] = await Promise.all([
      this.prisma.pageView.count({ where }),
      this.prisma.pageView.groupBy({
        by: ["sessionId"],
        where,
      }),
      this.prisma.pageView.count({
        where: { ...where, createdAt: { gte: todayStart, lte: todayEnd } },
      }),
      this.prisma.pageView.groupBy({
        by: ["sessionId"],
        where: {
          isBot: false,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      this.prisma.$queryRaw<
        Array<{ day: Date; pageViews: bigint; uniqueVisitors: bigint }>
      >`
        SELECT
          DATE("createdAt") AS day,
          COUNT(*)::bigint AS "pageViews",
          COUNT(DISTINCT "sessionId")::bigint AS "uniqueVisitors"
        FROM "page_views"
        WHERE "isBot" = false
          AND "createdAt" >= ${range.from}
          AND "createdAt" <= ${range.to}
        GROUP BY DATE("createdAt")
        ORDER BY day ASC
      `,
      this.prisma.pageView.groupBy({
        by: ["path"],
        where,
        _count: { _all: true },
        orderBy: { _count: { path: "desc" } },
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
          COUNT(DISTINCT "sessionId")::bigint AS "uniqueVisitors"
        FROM "page_views"
        WHERE "isBot" = false
          AND "createdAt" >= ${range.from}
          AND "createdAt" <= ${range.to}
        GROUP BY country, region, city, "geoSource"
        ORDER BY "pageViews" DESC
        LIMIT 12
      `,
      this.prisma.pageView.groupBy({
        by: ["deviceType"],
        where,
        _count: { _all: true },
        orderBy: { _count: { deviceType: "desc" } },
      }),
      this.prisma.pageView.groupBy({
        by: ["browser"],
        where,
        _count: { _all: true },
        orderBy: { _count: { browser: "desc" } },
        take: 8,
      }),
    ]);

    const topPaths = topPagesRaw.map((r) => r.path);
    const titles = topPaths.length
      ? await this.prisma.pageView.findMany({
          where: { path: { in: topPaths }, title: { not: null } },
          select: { path: true, title: true },
          orderBy: { createdAt: "desc" },
          distinct: ["path"],
        })
      : [];
    const titleMap = new Map(titles.map((t) => [t.path, t.title]));

    const topPagesUv = await Promise.all(
      topPagesRaw.map(async (row) => {
        const uv = await this.prisma.pageView.groupBy({
          by: ["sessionId"],
          where: { ...where, path: row.path },
        });
        return {
          path: row.path,
          title: titleMap.get(row.path) ?? null,
          pageViews: row._count._all,
          uniqueVisitors: uv.length,
        };
      }),
    );

    return {
      summary: {
        pageViews,
        uniqueVisitors: uniqueRows.length,
        pageViewsToday,
        uniqueVisitorsToday: uniqueTodayRows.length,
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
        referrerHost: row.referrerHost ?? "—",
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
        deviceType: row.deviceType ?? "unknown",
        count: row._count._all,
      })),
      browsers: browsersRaw.map((row) => ({
        browser: row.browser ?? "Other",
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
        id: `${row.country ?? ""}-${row.region ?? ""}-${row.city ?? ""}-${row.geoSource ?? ""}-${i}`,
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
        id: `${row.referrerHost ?? ""}-${row.country ?? ""}-${row.region ?? ""}-${row.geoSource ?? ""}-${i}`,
        referrerHost: row.referrerHost ?? "—",
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
}
