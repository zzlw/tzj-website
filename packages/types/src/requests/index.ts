import type { CaseType, NewsCategory, BlogCategory, TradeShowType } from "../enums/index.js";

/**
 * 通用查询参数
 */
export interface QueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * 工程案例查询参数
 */
export interface CaseQueryParams extends QueryParams {
  caseType?: CaseType;
  location?: string;
}

/**
 * 新闻查询参数
 */
export interface NewsQueryParams extends QueryParams {
  category?: NewsCategory;
  author?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * 博客查询参数
 */
export interface BlogQueryParams extends QueryParams {
  category?: BlogCategory;
}

/**
 * 展会查询参数
 */
export interface TradeShowQueryParams extends QueryParams {
  eventType?: TradeShowType;
}
