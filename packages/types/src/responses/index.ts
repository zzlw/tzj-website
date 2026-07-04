/**
 * 通用 API 响应封装
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * 错误响应
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
  timestamp: string;
}

/**
 * 健康检查响应
 */
export interface HealthCheckResponse {
  status: "ok" | "degraded" | "down";
  version: string;
  uptime: number;
  timestamp: string;
  services: Record<string, "up" | "down" | "degraded">;
}

/**
 * 认证响应
 */
export interface AuthResponse {
  success: boolean;
  token: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    username: string;
    displayName: string;
    role: string;
  };
}
