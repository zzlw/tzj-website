import type { NextResponse } from 'next/server';
import { API_BASE, COOKIE } from './config';

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

/** 进程内单飞刷新，避免并发 401 重复轮换触发「令牌复用」撤销全部会话。 */
let inflightRefresh: Promise<TokenPair | null> | null = null;

export async function refreshAccessToken(
  refreshToken: string | undefined,
): Promise<TokenPair | null> {
  if (!refreshToken) return null;
  if (inflightRefresh) return inflightRefresh;

  inflightRefresh = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const body = await res.json().catch(() => null);
      const data = body?.data ?? body;
      if (!data?.accessToken || !data?.refreshToken) return null;
      return {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      };
    } finally {
      inflightRefresh = null;
    }
  })();

  return inflightRefresh;
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
