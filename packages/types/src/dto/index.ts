import type { BlogCategory, CaseType, NewsCategory, TradeShowType } from '../enums/index.js';

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
  /** 持久匿名访客 ID（_tzj_vid，与埋点同源）：把询盘锚定到浏览轨迹，供转线索后反查访客抽屉。 */
  visitorId?: string;
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

export type {
  AnalyticsIpTrafficRow,
  BlockedIpItem,
  BlockIpDuration,
  CreateBlockedIpDto,
} from './analytics.js';
export { BLOCK_IP_DURATION_LABELS } from './analytics.js';
export type {
  InfrastructureSecretStatus,
  IntegrationAdminItem,
  IntegrationDef,
  IntegrationFieldDef,
  IntegrationOperatorUser,
  IntegrationSecretMask,
  IntegrationSetupStep,
  IntegrationsAdminOverview,
  IntegrationsPublicConfig,
  IntegrationTestResult,
  UpdateIntegrationDto,
} from './integrations.js';
export type {
  SiteMediaSettings,
  WatermarkFolder,
  WatermarkLayout,
  WatermarkMode,
  WatermarkPosition,
} from './site-media.js';
export { WATERMARK_POSITION_LABELS } from './site-media.js';
export type {
  NotificationChannel,
  NotificationLogItem,
  NotificationStatus,
  NotificationTemplate,
  SiteNotificationSettings,
} from './site-notifications.js';
export type {
  AgentProfile,
  AnalyticsGeoMode,
  BusinessHours,
  ChatPrompts,
  LocalizedText,
  PageViewGeoSource,
  ScreenWatermark,
  SitePublicSettings,
  SocialChannelPurpose,
  SocialChannelSetting,
  SocialPlatformId,
} from './site-settings.js';
export type { DependencyStatus, SystemStatusResponse } from './system-status.js';
export type {
  LoginResult,
  MeResult,
  SecurityAuthSettings,
  TwoFactorEnableResult,
  TwoFactorSetupResult,
  TwoFactorStatusResult,
  TwoFactorVerifyRequest,
  TwoFactorVerifyResult,
} from './auth.js';
export { TWOFA_ENROLLMENT_REQUIRED } from './auth.js';
