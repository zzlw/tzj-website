/** API 基址：服务端(BFF)与客户端共用。默认指向本地 Nest API。 */
export const API_BASE =
  process.env.ADMIN_API_URL ||
  process.env.NEXT_PUBLIC_ADMIN_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4000/api/v1';

/** 应用根路径前缀；独立域名部署时留空，子路径部署可通过环境变量覆盖。 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** 前台站点基址：用于内容预览跳转。 */
export const WEB_BASE = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3001';

export const COOKIE = {
  access: 'tzj_at',
  refresh: 'tzj_rt',
} as const;

export type Role = string;

export interface SessionUser {
  id: string;
  username: string;
  role: string;
  permissions?: string[];
  nickname?: string | null;
  exp?: number;
}
