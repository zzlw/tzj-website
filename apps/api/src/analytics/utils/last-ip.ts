import { Prisma } from '@prisma/client/index';
import type { PrismaService } from '../../prisma/prisma.service';

/** page_views 按 userId/visitorId 聚合出的「最近一次非空 IP + 地区 + 首触来源」行。 */
export interface LastIpRow {
  key: string;
  lastIp: string | null;
  lastIpMasked: string | null;
  lastIpHash: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  lastSeenAt: Date | null;
  /** 首触来源渠道（trafficSource：direct/organic/paid/social/email/referral/other） */
  channel: string | null;
  /** 首触引荐域名 */
  referrerHost: string | null;
}

/**
 * 按给定 key（userId 或 visitorId）批量聚合 page_views 的最近一次非空 IP 与地区，
 * 以及首触来源渠道/引荐域名（首触归因，与访客中心「来源」列口径一致）。
 * 剔除爬虫（isBot=false），同时返回明文 ip、脱敏 ipMasked 与 ipHash。
 * 供询盘 / 客户列表富化「最后访问 IP」「地区」「来源」列复用。
 */
export function aggregateLastIp(
  prisma: PrismaService,
  keyColumn: 'userId' | 'visitorId',
  keys: string[],
): Promise<LastIpRow[]> {
  if (keys.length === 0) return Promise.resolve([]);
  const column = Prisma.raw(`"${keyColumn}"`);
  return prisma.$queryRaw<LastIpRow[]>(Prisma.sql`
    SELECT ${column} AS "key",
      (ARRAY_AGG("ip" ORDER BY "createdAt" DESC) FILTER (WHERE "ip" IS NOT NULL))[1] AS "lastIp",
      (ARRAY_AGG("ipMasked" ORDER BY "createdAt" DESC) FILTER (WHERE "ipMasked" IS NOT NULL))[1] AS "lastIpMasked",
      (ARRAY_AGG("ipHash" ORDER BY "createdAt" DESC) FILTER (WHERE "ipHash" IS NOT NULL))[1] AS "lastIpHash",
      (ARRAY_AGG("country" ORDER BY "createdAt" DESC) FILTER (WHERE "country" IS NOT NULL))[1] AS "country",
      (ARRAY_AGG("region" ORDER BY "createdAt" DESC) FILTER (WHERE "region" IS NOT NULL))[1] AS "region",
      (ARRAY_AGG("city" ORDER BY "createdAt" DESC) FILTER (WHERE "city" IS NOT NULL))[1] AS "city",
      (ARRAY_AGG("trafficSource" ORDER BY "createdAt" ASC) FILTER (WHERE "trafficSource" IS NOT NULL))[1] AS "channel",
      (ARRAY_AGG("referrerHost" ORDER BY "createdAt" ASC) FILTER (WHERE "referrerHost" IS NOT NULL))[1] AS "referrerHost",
      MAX("createdAt") AS "lastSeenAt"
    FROM "page_views"
    WHERE "isBot" = false AND ${column} IN (${Prisma.join(keys)})
    GROUP BY ${column}
  `);
}

/** 两条关联口径命中时取最近一次访问的那条（缺一即返回另一条）。 */
export function pickLatestIp(
  a: LastIpRow | undefined,
  b: LastIpRow | undefined,
): LastIpRow | undefined {
  if (!a) return b;
  if (!b) return a;
  const ta = a.lastSeenAt?.getTime() ?? 0;
  const tb = b.lastSeenAt?.getTime() ?? 0;
  return tb > ta ? b : a;
}
