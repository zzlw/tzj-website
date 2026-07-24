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
  /** 全文检索关键词（各列表按各自可检索字段 ILIKE） */
  q?: string;
  /** 来源渠道过滤（trafficSource：direct/organic/paid/social/email/referral/other） */
  channel?: string;
  /** 设备类型过滤（desktop/mobile/tablet） */
  deviceType?: string;
  /** 身份状态过滤（'true'=已识别 / 'false'=匿名）——仅「按访客」 */
  identified?: string;
  /** 关键页触达过滤（contact/case/any）——仅「按访客」 */
  keyPage?: string;
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

/**
 * 按访客归并（COALESCE(userId, visitorId)）的明细排序。
 * 身份/来源/设备为代表值或读取时重解析，DB 排序无意义，
 * 故仅对 SQL 原生可聚合列（PV/会话数/首末访问）开放排序。
 */
export function visitorOrderClause(sortBy?: string, sortOrder?: string): Prisma.Sql {
  const dir = parseSortOrder(sortOrder);
  switch (sortBy) {
    case 'pageViews':
      return dir === 'asc' ? Prisma.sql`"pageViews" ASC` : Prisma.sql`"pageViews" DESC`;
    case 'sessions':
      return dir === 'asc' ? Prisma.sql`"sessions" ASC` : Prisma.sql`"sessions" DESC`;
    case 'firstSeenAt':
      return dir === 'asc' ? Prisma.sql`"firstSeenAt" ASC` : Prisma.sql`"firstSeenAt" DESC`;
    case 'lastSeenAt':
    default:
      return dir === 'asc' ? Prisma.sql`"lastSeenAt" ASC` : Prisma.sql`"lastSeenAt" DESC`;
  }
}

/**
 * 按 IP 聚合的访客明细排序。地区/来源/设备为读取时重解析或代表值，DB 排序无意义，
 * 故仅对 SQL 原生可聚合列（PV/会话数/最近访问）开放排序。
 */
export function visitorDetailOrderClause(sortBy?: string, sortOrder?: string): Prisma.Sql {
  const dir = parseSortOrder(sortOrder);
  switch (sortBy) {
    case 'sessions':
      return dir === 'asc' ? Prisma.sql`"sessions" ASC` : Prisma.sql`"sessions" DESC`;
    case 'lastSeenAt':
      return dir === 'asc' ? Prisma.sql`"lastSeenAt" ASC` : Prisma.sql`"lastSeenAt" DESC`;
    case 'pageViews':
    default:
      return dir === 'asc' ? Prisma.sql`"pageViews" ASC` : Prisma.sql`"pageViews" DESC`;
  }
}

/**
 * 「按访客」基础 CTE 内的行级过滤片段（依赖 pv./v. 别名，拼在 base WHERE 末尾）：
 * — 身份状态（v.identifiedAt 是否为空）；
 * — 全文检索 q（姓名/邮箱/电话/公司 + 访客ID + 地区/城市）。
 * 无条件时返回空片段。
 */
export function visitorBaseFilterSql(params: { q?: string; identified?: string }): Prisma.Sql {
  const conds: Prisma.Sql[] = [];
  if (params.identified === 'true') conds.push(Prisma.sql`v."identifiedAt" IS NOT NULL`);
  else if (params.identified === 'false') conds.push(Prisma.sql`v."identifiedAt" IS NULL`);
  if (params.q) {
    const like = `%${params.q}%`;
    conds.push(
      Prisma.sql`(v."email" ILIKE ${like} OR v."name" ILIKE ${like} OR v."phone" ILIKE ${like} OR v."company" ILIKE ${like} OR pv."visitorId" ILIKE ${like} OR pv."region" ILIKE ${like} OR pv."city" ILIKE ${like})`,
    );
  }
  return conds.length ? Prisma.sql`AND ${Prisma.join(conds, ' AND ')}` : Prisma.sql``;
}

/**
 * 「按访客」归并后的组级过滤（依赖聚合列别名 channel/deviceType/touched*，套在 grouped 之外）。
 * 渠道/设备按代表值等值匹配（与前端展示一致）；关键页按布尔触达。
 */
export function visitorGroupWhereSql(params: {
  channel?: string;
  deviceType?: string;
  keyPage?: string;
}): Prisma.Sql {
  const conds: Prisma.Sql[] = [];
  if (params.channel) conds.push(Prisma.sql`"channel" = ${params.channel}`);
  if (params.deviceType) conds.push(Prisma.sql`"deviceType" = ${params.deviceType}`);
  if (params.keyPage === 'contact') conds.push(Prisma.sql`"touchedContact" = true`);
  else if (params.keyPage === 'case') conds.push(Prisma.sql`"touchedCase" = true`);
  else if (params.keyPage === 'any')
    conds.push(Prisma.sql`("touchedContact" = true OR "touchedCase" = true)`);
  return conds.length ? Prisma.sql`WHERE ${Prisma.join(conds, ' AND ')}` : Prisma.sql``;
}

/**
 * 「按 IP」 grouped CTE 内的全文检索片段（未限定列名，CTE 直接查 page_views）：
 * IP / 掩码 IP / 地区 / 城市 / 国家 / 浏览器 / 系统 / 引荐域名。无词时返回空片段。
 */
export function ipDetailSearchSql(q?: string): Prisma.Sql {
  if (!q) return Prisma.sql``;
  const like = `%${q}%`;
  return Prisma.sql`AND (ip ILIKE ${like} OR "ipMasked" ILIKE ${like} OR region ILIKE ${like} OR city ILIKE ${like} OR country ILIKE ${like} OR browser ILIKE ${like} OR os ILIKE ${like} OR "referrerHost" ILIKE ${like})`;
}

/** 「按 IP」归并后的组级过滤（依赖聚合列别名 trafficSource/deviceType，套在 grouped 之外）。 */
export function ipDetailGroupWhereSql(params: {
  channel?: string;
  deviceType?: string;
}): Prisma.Sql {
  const conds: Prisma.Sql[] = [];
  if (params.channel) conds.push(Prisma.sql`"trafficSource" = ${params.channel}`);
  if (params.deviceType) conds.push(Prisma.sql`"deviceType" = ${params.deviceType}`);
  return conds.length ? Prisma.sql`WHERE ${Prisma.join(conds, ' AND ')}` : Prisma.sql``;
}
