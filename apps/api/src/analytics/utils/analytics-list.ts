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
  /** 转化状态过滤（'true'=已转客户 / 'false'=未转化）——仅「按访客」 */
  converted?: string;
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

/**
 * 文本代表值列的白名单排序片段（依次比较、NULLS LAST，尾附最近活跃作稳定次序）。
 * 列名仅来自代码内常量（非用户输入），可安全使用 Prisma.raw。
 */
function textOrderSql(columns: string[], dir: SortOrder): Prisma.Sql {
  const d = dir === 'asc' ? 'ASC' : 'DESC';
  const parts = columns.map((c) => `${c} ${d} NULLS LAST`);
  return Prisma.raw(`${parts.join(', ')}, "lastSeenAt" DESC`);
}

/**
 * 「兼容性」列排序等级：0=不支持 / 1=支持 / 2=未知（asc 即不支持→支持→未知）。
 * ⨚︎ 口径与 admin `src/lib/browser-support.ts` 的 ES2020 基线阈值一致，修改需同步。
 * 版本取「大版本.小版本」数值（Safari 13.1 阈值需要小数；正则不带括号，
 * 避免 substring(from pattern) 返回捕获组而非整体匹配）。
 */
function browserSupportOrderSql(dir: SortOrder): Prisma.Sql {
  const v = `NULLIF(substring("browserVersion" from '^[0-9]+\\.?[0-9]*'), '')::numeric`;
  const rank = `CASE
    WHEN browser IS NULL THEN 2
    WHEN browser ~* '(internet explorer|iemobile)' OR lower(browser) = 'ie' THEN 0
    WHEN ${v} IS NULL THEN 2
    WHEN browser ~* 'edg' THEN (CASE WHEN ${v} >= 85 THEN 1 ELSE 0 END)
    WHEN browser ~* 'samsung' THEN (CASE WHEN ${v} >= 14 THEN 1 ELSE 0 END)
    WHEN browser ~* '(opera|opr)' THEN (CASE WHEN ${v} >= 71 THEN 1 ELSE 0 END)
    WHEN browser ~* 'firefox' THEN (CASE WHEN ${v} >= 77 THEN 1 ELSE 0 END)
    WHEN browser ~* '(chrome|chromium)' THEN (CASE WHEN ${v} >= 85 THEN 1 ELSE 0 END)
    WHEN browser ~* 'safari' THEN (CASE WHEN ${v} >= 13.1 THEN 1 ELSE 0 END)
    ELSE 2
  END`;
  return Prisma.raw(`${rank} ${dir === 'asc' ? 'ASC' : 'DESC'}, "lastSeenAt" DESC`);
}

/**
 * 两个 lens 共用的环境维度排序（设备/系统/浏览器/兼容性/访问软件/地区，
 * 列 key 与前端 device-columns 一致）；未命中返回 null 由调用方继续自有 switch。
 * 排序作用在聚合代表值列上（与列表展示同源），与前端所见一致。
 */
function deviceEnvOrderSql(sortBy: string | undefined, dir: SortOrder): Prisma.Sql | null {
  switch (sortBy) {
    case 'device':
      return textOrderSql(['"deviceType"', '"deviceVendor"', '"deviceModel"'], dir);
    case 'os':
      return textOrderSql(['os', '"osVersion"'], dir);
    case 'browser':
      return textOrderSql(['browser', '"browserVersion"'], dir);
    case 'browserSupport':
      return browserSupportOrderSql(dir);
    case 'clientApp':
      return textOrderSql(['"clientApp"'], dir);
    case 'region':
      return textOrderSql(['country', 'region', 'city'], dir);
    default:
      return null;
  }
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
 * 除 SQL 原生可聚合列（PV/会话数/首末访问/转化旗标）外，
 * 来源/设备/系统/浏览器/兼容性/访问软件/地区按聚合代表值排序（与列表展示同源）。
 */
export function visitorOrderClause(sortBy?: string, sortOrder?: string): Prisma.Sql {
  const dir = parseSortOrder(sortOrder);
  const envOrder = deviceEnvOrderSql(sortBy, dir);
  if (envOrder) return envOrder;
  switch (sortBy) {
    case 'channel':
      return textOrderSql(['"channel"'], dir);
    case 'pageViews':
      return dir === 'asc' ? Prisma.sql`"pageViews" ASC` : Prisma.sql`"pageViews" DESC`;
    case 'sessions':
      return dir === 'asc' ? Prisma.sql`"sessions" ASC` : Prisma.sql`"sessions" DESC`;
    case 'firstSeenAt':
      return dir === 'asc' ? Prisma.sql`"firstSeenAt" ASC` : Prisma.sql`"firstSeenAt" DESC`;
    case 'converted':
      // 布尔旗标同值行多，附最近活跃作稳定次序（desc=已转客户在前）
      return dir === 'asc'
        ? Prisma.sql`"converted" ASC, "lastSeenAt" DESC`
        : Prisma.sql`"converted" DESC, "lastSeenAt" DESC`;
    case 'lastSeenAt':
    default:
      return dir === 'asc' ? Prisma.sql`"lastSeenAt" ASC` : Prisma.sql`"lastSeenAt" DESC`;
  }
}

/**
 * 按 IP 聚合的访客明细排序。除 SQL 原生可聚合列（PV/会话数/最近访问）外，
 * 来源/设备/系统/浏览器/兼容性/访问软件/地区按聚合代表值排序
 * （地区展示时会按 IP 重解析，排序取入库值近似，同地区仍能有效聚类）。
 */
export function visitorDetailOrderClause(sortBy?: string, sortOrder?: string): Prisma.Sql {
  const dir = parseSortOrder(sortOrder);
  const envOrder = deviceEnvOrderSql(sortBy, dir);
  if (envOrder) return envOrder;
  switch (sortBy) {
    case 'channel':
      // 「按 IP」聚合列未重命名，沿用库字段名 trafficSource
      return textOrderSql(['"trafficSource"'], dir);
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
    // 前端访客ID展示为「#xxxxxxxx」，容忍用户连 # 一起复制来搜
    const like = `%${params.q.replace(/^#/, '')}%`;
    conds.push(
      Prisma.sql`(v."email" ILIKE ${like} OR v."name" ILIKE ${like} OR v."phone" ILIKE ${like} OR v."company" ILIKE ${like} OR pv."visitorId" ILIKE ${like} OR pv."region" ILIKE ${like} OR pv."city" ILIKE ${like})`,
    );
  }
  return conds.length ? Prisma.sql`AND ${Prisma.join(conds, ' AND ')}` : Prisma.sql``;
}

/**
 * 「按访客」人物级转化旗标（依赖 grouped 别名，作 flagged CTE 的计算列）。
 * 口径与 loadVisitorLeadStatuses 的 JS 归因一致（改动需同步）：
 * 行身份键（visitorId / userId=identify 回写的 contactId / email）命中
 * Customer.visitorId / Customer.contactId / 客户源询盘的 visitorId / email 任一即视为已转客户。
 * 软删的客户/询盘不参与归因（与 JS 侧 deletedAt: null 过滤同口径）。
 * IN 列表中的 NULL 项永不匹配，无需逐键判空。
 */
export function visitorConvertedFlagSql(): Prisma.Sql {
  return Prisma.sql`EXISTS (
    SELECT 1
    FROM "customers" cu
    LEFT JOIN "contacts" ct ON ct."id" = cu."contactId" AND ct."deletedAt" IS NULL
    WHERE cu."deletedAt" IS NULL
      AND (
        cu."visitorId" IN (COALESCE(grouped."visitorId", grouped."mergeKey"), grouped."userId", grouped."email")
        OR cu."contactId" IN (COALESCE(grouped."visitorId", grouped."mergeKey"), grouped."userId", grouped."email")
        OR ct."visitorId" IN (COALESCE(grouped."visitorId", grouped."mergeKey"), grouped."userId", grouped."email")
        OR ct."email" IN (COALESCE(grouped."visitorId", grouped."mergeKey"), grouped."userId", grouped."email")
      )
  )`;
}

/**
 * 「按访客」归并后的组级过滤（依赖聚合列别名 channel/deviceType/touched两旗标/converted，套在 flagged 之外）。
 * 渠道/设备按代表值等值匹配（与前端展示一致）；关键页/转化状态按布尔旗标。
 */
export function visitorGroupWhereSql(params: {
  channel?: string;
  deviceType?: string;
  keyPage?: string;
  converted?: string;
}): Prisma.Sql {
  const conds: Prisma.Sql[] = [];
  if (params.channel) conds.push(Prisma.sql`"channel" = ${params.channel}`);
  if (params.deviceType) conds.push(Prisma.sql`"deviceType" = ${params.deviceType}`);
  if (params.keyPage === 'contact') conds.push(Prisma.sql`"touchedContact" = true`);
  else if (params.keyPage === 'case') conds.push(Prisma.sql`"touchedCase" = true`);
  else if (params.keyPage === 'any')
    conds.push(Prisma.sql`("touchedContact" = true OR "touchedCase" = true)`);
  if (params.converted === 'true') conds.push(Prisma.sql`"converted" = true`);
  else if (params.converted === 'false') conds.push(Prisma.sql`"converted" = false`);
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
