import type { CaseType, NewsCategory, BlogCategory, TradeShowType } from "../enums/index.js";

/**
 * 创建工程案例 DTO
 */
export interface CreateCaseDto {
  title: string;
  slug: string;
  description: string;
  content: string;
  coverImage: string;
  images?: string[];
  caseType: CaseType;
  location: string;
  clientName: string;
  completionDate: string;
}

/**
 * 更新工程案例 DTO
 */
export interface UpdateCaseDto extends Partial<CreateCaseDto> {}

/**
 * 创建新闻 DTO
 */
export interface CreateNewsDto {
  title: string;
  slug: string;
  summary: string;
  content: string;
  coverImage: string;
  category: NewsCategory;
  author: string;
}

/**
 * 更新新闻 DTO
 */
export interface UpdateNewsDto extends Partial<CreateNewsDto> {}

/**
 * 创建博客 DTO
 */
export interface CreateBlogDto {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: BlogCategory;
  readTime?: string;
  author?: string;
  isFeatured?: boolean;
  sortOrder?: number;
}

/**
 * 更新博客 DTO
 */
export interface UpdateBlogDto extends Partial<CreateBlogDto> {}

/**
 * 创建展会 DTO
 */
export interface CreateTradeShowDto {
  title: string;
  slug: string;
  summary?: string;
  content?: string;
  location?: string;
  eventDateLabel?: string;
  startDate?: string | null;
  endDate?: string | null;
  boothNumber?: string;
  eventType?: TradeShowType;
  coverImage?: string;
  images?: string[];
  externalUrl?: string;
  isFeatured?: boolean;
  sortOrder?: number;
}

/**
 * 更新展会 DTO
 */
export interface UpdateTradeShowDto extends Partial<CreateTradeShowDto> {}

/**
 * 创建联系/咨询 DTO（前端表单提交）
 */
export interface CreateContactDto {
  name: string;
  phone: string;
  email: string;
  company?: string;
  subject: string;
  message: string;
  source?: string;
}

/**
 * 登录 DTO
 */
export interface LoginDto {
  username: string;
  password: string;
}

/**
 * 创建用户 DTO
 */
export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
  displayName: string;
  role?: string;
}
