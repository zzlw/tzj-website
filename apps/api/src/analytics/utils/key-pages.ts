import { Prisma } from '@prisma/client/index';

/**
 * 企业官网「意向轻代理」关键页路径段（Phase 1：仅布尔触达标记，不做数值打分）。
 * 站点为 locale 前缀路由（如 /en/contact、/zh/cases），故按路径「段」匹配而非全等。
 * 规则集中于此，站点信息架构调整时只改这里。
 */
export const CONTACT_PATH_SEGMENTS = ['contact'] as const;
export const CASE_PATH_SEGMENTS = ['cases', 'solutions'] as const;

function includesSegment(path: string, segments: readonly string[]): boolean {
  return segments.some((s) => path.includes(`/${s}`));
}

/** 是否触达联系类页面（「点联系方式」意向） */
export function touchedContact(path: string): boolean {
  return includesSegment(path, CONTACT_PATH_SEGMENTS);
}

/** 是否触达案例/解决方案类页面（「看案例、评估选型」意向） */
export function touchedCase(path: string): boolean {
  return includesSegment(path, CASE_PATH_SEGMENTS);
}

/**
 * 生成聚合查询用的 BOOL_OR(...) 片段：分组内任一行 path 命中任一段即为 true。
 * 引用未限定的 "path" 列，供 base CTE 之上的外层聚合使用。
 */
export function keyPageTouchedSql(segments: readonly string[]): Prisma.Sql {
  const conds = segments.map((s) => Prisma.sql`"path" ILIKE ${`%/${s}%`}`);
  return Prisma.sql`BOOL_OR(${Prisma.join(conds, ' OR ')})`;
}
