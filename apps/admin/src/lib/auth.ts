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

async function refreshTokens(): Promise<{ accessToken: string; refreshToken: string } | null> {
  const store = await cookies();
  const refreshToken = store.get(COOKIE.refresh)?.value;
  const { refreshAccessToken } = await import('./tokenRefresh');
  return refreshAccessToken(refreshToken);
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

  if (res.status === 401) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      token = refreshed.accessToken;
      // 注意：Server Component 内无法写 cookie，轮换后的新 token 仅本次请求使用；
      // 持久化由 middleware / route handler 负责。
      res = await doFetch(token);
    }
  }

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
