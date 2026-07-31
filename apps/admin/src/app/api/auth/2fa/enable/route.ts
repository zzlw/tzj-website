import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { API_BASE, COOKIE } from '@/lib/config';
import { forwardMetaHeaders } from '@/lib/forward-meta';
import {
  applyTokenCookies,
  refreshAccessToken,
  type TokenPair,
  UPSTREAM_UNAVAILABLE_BODY,
} from '@/lib/tokenRefresh';

/**
 * 2FA enable 专门路由（不走通用 bff 代理）：
 * 需从 httpOnly cookie 注入当前 refreshToken——API 侧据此识别「当前会话」，
 * 启用时撤销其他会话并给当前会话打 twoFactorVerifiedAt 标记，避免启用者被误踢。
 */
export async function POST(req: NextRequest) {
  let payload: { code?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: '请求格式错误' }, { status: 400 });
  }

  const store = await cookies();
  let accessToken = store.get(COOKIE.access)?.value;
  const refreshToken = store.get(COOKIE.refresh)?.value;

  const forward = (bearer?: string) =>
    fetch(`${API_BASE}/auth/2fa/enable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...forwardMetaHeaders(req),
      },
      body: JSON.stringify({ code: payload.code, refreshToken }),
      cache: 'no-store',
    });

  let apiRes = await forward(accessToken);
  let rotated: TokenPair | null = null;

  if (apiRes.status === 401) {
    const refreshed = await refreshAccessToken(refreshToken);
    if (refreshed.ok) {
      rotated = refreshed.tokens;
      accessToken = rotated.accessToken;
      // 注意：刷新已轮换 refreshToken，改用新令牌标识当前会话
      apiRes = await fetch(`${API_BASE}/auth/2fa/enable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          ...forwardMetaHeaders(req),
        },
        body: JSON.stringify({ code: payload.code, refreshToken: rotated.refreshToken }),
        cache: 'no-store',
      });
    } else if (refreshed.transient) {
      // 上游临时故障：不透传 401（会被前端当会话失效），返回 502 让用户稍后重试
      return NextResponse.json(UPSTREAM_UNAVAILABLE_BODY, { status: 502 });
    }
  }

  const text = await apiRes.text();
  const res = new NextResponse(text, {
    status: apiRes.status,
    headers: { 'content-type': apiRes.headers.get('content-type') || 'application/json' },
  });
  if (rotated) applyTokenCookies(res, rotated);
  return res;
}
