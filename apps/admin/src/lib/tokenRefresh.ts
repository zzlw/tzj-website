import type { NextResponse } from 'next/server';
import { API_BASE, COOKIE } from './config';

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

/**
 * 刷新结果三态：
 *  - ok：轮换成功，携带新令牌对；
 *  - transient=true：网络错误 / API 5xx（滚动部署、瞬断）——令牌可能仍有效，
 *    调用方不得据此清 cookie 或跳登录，应返回 502 让前端退避重试；
 *  - transient=false：refresh 接口明确拒绝（401/403 等）——会话真失效，可跳登录。
 */
export type RefreshOutcome = { ok: true; tokens: TokenPair } | { ok: false; transient: boolean };

/**
 * 进程内单飞刷新，避免并发 401 重复轮换触发「令牌复用」。
 * 必须按 refreshToken 隔离：全局不分 key 的单飞锁会在并发窗口内把
 * 用户 A 的令牌对发给用户 B（身份串号）。
 */
const inflightByToken = new Map<string, Promise<RefreshOutcome>>();

export async function refreshAccessToken(
  refreshToken: string | undefined,
): Promise<RefreshOutcome> {
  if (!refreshToken) return { ok: false, transient: false };

  const existing = inflightByToken.get(refreshToken);
  if (existing) return existing;

  const task = (async (): Promise<RefreshOutcome> => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
      });
      if (!res.ok) {
        // 4xx = 令牌被明确拒绝；5xx = 上游临时故障，不算会话失效
        return { ok: false, transient: res.status >= 500 };
      }
      const body = await res.json().catch(() => null);
      const data = body?.data ?? body;
      if (!data?.accessToken || !data?.refreshToken) {
        return { ok: false, transient: true };
      }
      return {
        ok: true,
        tokens: { accessToken: data.accessToken, refreshToken: data.refreshToken },
      };
    } catch {
      // 网络异常（API 重启中/瞬断）：令牌状态未知，按临时故障处理
      return { ok: false, transient: true };
    } finally {
      inflightByToken.delete(refreshToken);
    }
  })();

  inflightByToken.set(refreshToken, task);
  return task;
}

export function applyTokenCookies(res: NextResponse, tokens: TokenPair): void {
  const secure = process.env.NODE_ENV === 'production';
  res.cookies.set(COOKIE.access, tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60,
  });
  res.cookies.set(COOKIE.refresh, tokens.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

/** 上游临时不可用的统一 502 负载（前端轮询/React Query 据此退避重试而非跳登录）。 */
export const UPSTREAM_UNAVAILABLE_BODY = {
  success: false,
  error: { code: 'UPSTREAM_UNAVAILABLE', message: '服务暂时不可用，请稍后重试' },
} as const;
