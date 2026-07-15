import { Prisma } from '@prisma/client/index';
import type { SortOrder } from '../../common/utils/list-sort';

export interface AnalyticsListParams {
  page: number;
  limit: number;
  from?: string;
  to?: string;
  sortBy?: string;
  sortOrder?: string;
  /** 仅返回 PV 排名前 N 的 IP（安全页高频 IP 用） */
  top?: number;
}

export function paginateMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

function parseSortOrder(v?: string): SortOrder {
  return v === 'asc' ? 'asc' : 'desc';
}

export function pageOrderClause(sortBy?: string, sortOrder?: string): Prisma.Sql {
  const dir = parseSortOrder(sortOrder);
  switch (sortBy) {
    case 'path':
      return dir === 'asc' ? Prisma.sql`path ASC` : Prisma.sql`path DESC`;
    case 'title':
      return dir === 'asc' ? Prisma.sql`title ASC NULLS LAST` : Prisma.sql`title DESC NULLS LAST`;
    case 'uniqueVisitors':
      return dir === 'asc' ? Prisma.sql`"uniqueVisitors" ASC` : Prisma.sql`"uniqueVisitors" DESC`;
    case 'pageViews':
    default:
      return dir === 'asc' ? Prisma.sql`"pageViews" ASC` : Prisma.sql`"pageViews" DESC`;
  }
}

export function regionOrderClause(sortBy?: string, sortOrder?: string): Prisma.Sql {
  const dir = parseSortOrder(sortOrder);
  switch (sortBy) {
    case 'region':
      return dir === 'asc'
        ? Prisma.sql`country ASC NULLS LAST, region ASC NULLS LAST, city ASC NULLS LAST`
        : Prisma.sql`country DESC NULLS LAST, region DESC NULLS LAST, city DESC NULLS LAST`;
    case 'geoSource':
      return dir === 'asc'
        ? Prisma.sql`"geoSource" ASC NULLS LAST`
        : Prisma.sql`"geoSource" DESC NULLS LAST`;
    case 'uniqueVisitors':
      return dir === 'asc' ? Prisma.sql`"uniqueVisitors" ASC` : Prisma.sql`"uniqueVisitors" DESC`;
    case 'pageViews':
    default:
      return dir === 'asc' ? Prisma.sql`"pageViews" ASC` : Prisma.sql`"pageViews" DESC`;
  }
}

export function referrerOrderClause(sortBy?: string, sortOrder?: string): Prisma.Sql {
  const dir = parseSortOrder(sortOrder);
  switch (sortBy) {
    case 'referrerHost':
      return dir === 'asc' ? Prisma.sql`"referrerHost" ASC` : Prisma.sql`"referrerHost" DESC`;
    case 'region':
      return dir === 'asc'
        ? Prisma.sql`country ASC NULLS LAST, region ASC NULLS LAST, city ASC NULLS LAST`
        : Prisma.sql`country DESC NULLS LAST, region DESC NULLS LAST, city DESC NULLS LAST`;
    case 'geoSource':
      return dir === 'asc'
        ? Prisma.sql`"geoSource" ASC NULLS LAST`
        : Prisma.sql`"geoSource" DESC NULLS LAST`;
    case 'pageViews':
    default:
      return dir === 'asc' ? Prisma.sql`"pageViews" ASC` : Prisma.sql`"pageViews" DESC`;
  }
}
