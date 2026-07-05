import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { formatGeoLabel } from "../analytics/utils/geo-label";
import {
  type AnalyticsListParams,
  paginateMeta,
} from "../analytics/utils/analytics-list";

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

@Injectable()
export class SecurityService {
  constructor(private readonly prisma: PrismaService) {}

  /** 按 IP 聚合访问流量，供安全运维识别异常访客 */
  async listIpTraffic(params: AnalyticsListParams) {
    const { page, limit, from, to, top } = params;
    const range = parseRange(from, to);
    const skip = (page - 1) * limit;
    const topCap = top && top > 0 ? top : null;

    const [countRow, rows] = await Promise.all([
      topCap
        ? this.prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*)::bigint AS count FROM (
              SELECT "ipHash" FROM "page_views"
              WHERE "isBot" = false
                AND "ipHash" IS NOT NULL
                AND "createdAt" >= ${range.from}
                AND "createdAt" <= ${range.to}
              GROUP BY "ipHash"
              ORDER BY COUNT(*) DESC
              LIMIT ${topCap}
            ) capped
          `
        : this.prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*)::bigint AS count FROM (
              SELECT "ipHash" FROM "page_views"
              WHERE "isBot" = false
                AND "ipHash" IS NOT NULL
                AND "createdAt" >= ${range.from}
                AND "createdAt" <= ${range.to}
              GROUP BY "ipHash"
            ) grouped
          `,
      topCap
        ? this.prisma.$queryRaw<
            Array<{
              ipHash: string;
              ip: string | null;
              ipMasked: string | null;
              country: string | null;
              region: string | null;
              city: string | null;
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
                COUNT(*)::bigint AS "pageViews",
                COUNT(DISTINCT "sessionId")::bigint AS "uniqueVisitors",
                MAX("createdAt") AS "lastSeenAt"
              FROM "page_views"
              WHERE "isBot" = false
                AND "ipHash" IS NOT NULL
                AND "createdAt" >= ${range.from}
                AND "createdAt" <= ${range.to}
              GROUP BY "ipHash"
            ),
            top_n AS (
              SELECT * FROM grouped
              ORDER BY "pageViews" DESC
              LIMIT ${topCap}
            )
            SELECT * FROM top_n
            ORDER BY "pageViews" DESC
            LIMIT ${limit} OFFSET ${skip}
          `
        : this.prisma.$queryRaw<
            Array<{
              ipHash: string;
              ip: string | null;
              ipMasked: string | null;
              country: string | null;
              region: string | null;
              city: string | null;
              pageViews: bigint;
              uniqueVisitors: bigint;
              lastSeenAt: Date;
            }>
          >`
            SELECT
              "ipHash",
              (ARRAY_AGG(ip ORDER BY "createdAt" DESC) FILTER (WHERE ip IS NOT NULL))[1] AS ip,
              (ARRAY_AGG("ipMasked" ORDER BY "createdAt" DESC) FILTER (WHERE "ipMasked" IS NOT NULL))[1] AS "ipMasked",
              (ARRAY_AGG(country ORDER BY "createdAt" DESC) FILTER (WHERE country IS NOT NULL))[1] AS country,
              (ARRAY_AGG(region ORDER BY "createdAt" DESC) FILTER (WHERE region IS NOT NULL))[1] AS region,
              (ARRAY_AGG(city ORDER BY "createdAt" DESC) FILTER (WHERE city IS NOT NULL))[1] AS city,
              COUNT(*)::bigint AS "pageViews",
              COUNT(DISTINCT "sessionId")::bigint AS "uniqueVisitors",
              MAX("createdAt") AS "lastSeenAt"
            FROM "page_views"
            WHERE "isBot" = false
              AND "ipHash" IS NOT NULL
              AND "createdAt" >= ${range.from}
              AND "createdAt" <= ${range.to}
            GROUP BY "ipHash"
            ORDER BY "pageViews" DESC
            LIMIT ${limit} OFFSET ${skip}
          `,
    ]);

    const total = Number(countRow[0]?.count ?? 0);

    return {
      data: rows.map((row) => ({
        id: row.ipHash,
        ip: row.ip,
        ipMasked: row.ipMasked,
        region: formatGeoLabel({
          country: row.country,
          region: row.region,
          city: row.city,
        }),
        pageViews: Number(row.pageViews),
        uniqueVisitors: Number(row.uniqueVisitors),
        lastSeenAt: row.lastSeenAt.toISOString(),
      })),
      pagination: paginateMeta(page, limit, total),
    };
  }
}
