import { Prisma } from '@prisma/client/index';
import type { PrismaService } from '../../prisma/prisma.service';

/** page_views 按 userId/visitorId 聚合出的「最近一次非空 IP」行。 */
export interface LastIpRow {
  key: string;
  lastIp: string | null;
  lastIpMasked: string | null;
  lastIpHash: string | null;
  lastSeenAt: Date | null;
}

/**
 * 按给定 key（userId 或 visitorId）批量聚合 page_views 的最近一次非空 IP。
 * 剔除爬虫（isBot=false），同时返回明文 ip、脱敏 ipMasked 与 ipHash。
 * 供询盘 / 客户列表富化「最后访问 IP」列复用。
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
