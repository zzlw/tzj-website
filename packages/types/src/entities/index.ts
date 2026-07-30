import type {
  BlogCategory,
  CaseType,
  NewsCategory,
  PublishStatus,
  TradeShowType,
  UserRole,
} from '../enums/index.js';

/**
 * 基础实体接口
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 工程案例实体
 */
export interface Case extends BaseEntity {
  title: string;
  slug: string;
  description: string;
  content: string;
  coverImage: string;
  images: string[];
  caseType: CaseType;
  location: string;
  clientName: string;
  completionDate: Date;
  status: PublishStatus;
}

/**
 * 新闻资讯实体
 */
export interface News extends BaseEntity {
  title: string;
  slug: string;
  summary: string;
  content: string;
  coverImage: string;
  category: NewsCategory;
  author: string;
  publishedAt: Date | null;
  status: PublishStatus;
  viewCount: number;
}

/**
 * 博客实体
 */
export interface Blog extends BaseEntity {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  images: string[];
  category: BlogCategory;
  readTime: string;
  author: string;
  isFeatured: boolean;
  sortOrder: number;
  publishedAt: Date | null;
  status: PublishStatus;
  viewCount: number;
}

/**
 * 展会活动实体
 */
export interface TradeShow extends BaseEntity {
  title: string;
  slug: string;
  summary: string;
  content: string;
  location: string;
  eventDateLabel: string;
  startDate: Date | null;
  endDate: Date | null;
  boothNumber: string;
  eventType: TradeShowType;
  coverImage: string;
  images: string[];
  externalUrl: string;
  isFeatured: boolean;
  sortOrder: number;
  publishedAt: Date | null;
  status: PublishStatus;
  viewCount: number;
}

/**
 * 联系我们/咨询记录实体
 */
export interface Contact extends BaseEntity {
  name: string;
  phone: string;
  email: string;
  company: string;
  subject: string;
  message: string;
  source: string;
  isRead: boolean;
  isHandled: boolean;
  handledAt: Date | null;
  handledBy: string | null;
}

/**
 * 静态页面实体
 */
export interface Page extends BaseEntity {
  title: string;
  slug: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  status: PublishStatus;
}

/**
 * 用户实体
 */
export interface User extends BaseEntity {
  username: string;
  email: string;
  passwordHash: string;
  displayName: string;
  avatar: string | null;
  role: UserRole;
  lastLoginAt: Date | null;
  isActive: boolean;
}

/**
 * 客户管理实体（私海 / 公海线索池）
 */
export interface Customer extends BaseEntity {
  name: string;
  company: string | null;
  title: string | null;
  phone: string | null;
  email: string | null;
  customerType: string;
  source: string | null;
  level: string;
  stage: string;
  amount: number | null;
  region: string | null;
  address: string | null;
  tags: string[];
  notes: string | null;
  ownerId: string | null;
  lastContactAt: Date | null;
  nextFollowAt: Date | null;
}

// 灵犀 AI 投放报告（docs/lingxi-ai-report-design.md §8）
export type * from './lingxi.js';
