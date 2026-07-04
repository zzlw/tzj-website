/**
 * @tzj/types — 共享类型包
 * 所有 App 和 Package 的类型单一来源
 */

// Enums
export {
  CaseType,
  CaseTypeLabels,
  NewsCategory,
  NewsCategoryLabels,
  BlogCategory,
  BlogCategoryLabels,
  TradeShowType,
  TradeShowTypeLabels,
  PublishStatus,
  UserRole,
} from "./enums/index.js";

// Entities
export type {
  BaseEntity,
  Case,
  News,
  Blog,
  TradeShow,
  Contact,
  Page,
  User,
} from "./entities/index.js";

// DTOs
export type {
  CreateCaseDto,
  UpdateCaseDto,
  CreateNewsDto,
  UpdateNewsDto,
  CreateBlogDto,
  UpdateBlogDto,
  CreateTradeShowDto,
  UpdateTradeShowDto,
  CreateContactDto,
  LoginDto,
  CreateUserDto,
} from "./dto/index.js";

// Responses
export type {
  ApiResponse,
  PaginatedResponse,
  ErrorResponse,
  HealthCheckResponse,
  AuthResponse,
} from "./responses/index.js";

// Requests
export type {
  QueryParams,
  CaseQueryParams,
  NewsQueryParams,
  BlogQueryParams,
  TradeShowQueryParams,
} from "./requests/index.js";
