import { cookies } from 'next/headers';
import { API_BASE, COOKIE, type Role, type SessionUser } from './config';
import { retryFetch } from './fetch-retry';

/** 解析 JWT payload（不校验签名，仅用于读取 UI 展示信息，真正校验在 API）。 */
function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** 从 access token cookie 读取当前会话（服务端）。 */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE.access)?.value;
  if (!token) return null;
  const payload = decodeJwt(token);
  if (!payload || typeof payload.sub !== 'string') return null;
  return {
    id: payload.sub,
    username: String(payload.username ?? ''),
    role: String(payload.role ?? 'admin'),
    exp: typeof payload.exp === 'number' ? payload.exp : undefined,
  };
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** 携带 Bearer 请求 API，401 时自动轮换一次；返回统一响应信封（含分页）。 */
async function rawRequest(
  path: string,
  init: RequestInit = {},
): Promise<{ data: unknown; pagination?: Pagination }> {
  const store = await cookies();
  let token = store.get(COOKIE.access)?.value;

  const doFetch = (bearer?: string) =>
    retryFetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...(init.headers ?? {}),
      },
      cache: 'no-store',
    });

  let res = await doFetch(token);

  // 重要：此处不再用 refresh token 自动续期。
  // 原因：Server Component（如 dashboard layout）内无法写 cookie，续期后的新 refresh token 无法持久化，
  // 会导致 cookie 里的旧 refresh token 在后续请求中被重复使用，命中后端「刷新令牌复用」检测
  // （auth.service.ts 会撤销该用户全部会话），表现为「点一下会话就跳登录」。
  // 令牌续期统一由 proxy.ts 在网络边界完成（它能同时写回 cookie 与请求头）。

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const message = errBody?.error?.message || errBody?.message || `API ${res.status}`;
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }

  const body = await res.json();
  return { data: body?.data ?? body, pagination: body?.pagination };
}

/**
 * 服务端携带 Bearer 调用 API 的封装（BFF）。
 * access token 过期时自动用 refresh token 轮换一次并重试。
 */
export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await rawRequest(path, init);
  return data as T;
}

/** 同 `apiFetch`，但返回信封（含分页），用于读取列表总数等。 */
export async function apiFetchFull<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<{ data: T; pagination?: Pagination }> {
  const { data, pagination } = await rawRequest(path, init);
  return { data: data as T, pagination };
}

export function can(role: string | undefined, allowed: string[]): boolean {
  return !!role && allowed.includes(role);
}

export function hasPermission(permissions: string[] | undefined, perm: string): boolean {
  return permissions?.includes(perm) ?? false;
}
