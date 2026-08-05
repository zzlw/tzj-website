import { isProduction } from '@tzj/env';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { API_BASE, COOKIE } from '@/lib/config';
import { retryFetch } from '@/lib/fetch-retry';
import { forwardMetaHeaders } from '@/lib/forward-meta';

export async function POST(req: NextRequest) {
  let payload: { username?: string; password?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: '请求格式错误' }, { status: 400 });
  }

  const { username, password } = payload;
  if (!username || !password) {
    return NextResponse.json({ success: false, message: '请输入账号和密码' }, { status: 400 });
  }

  const res = await retryFetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...forwardMetaHeaders(req) },
    body: JSON.stringify({ username, password }),
    cache: 'no-store',
  }); // 2FA 后 login 会签发 pendingToken（单用 jti），不再开启写重试

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.error?.message || body?.message || '登录失败';
    return NextResponse.json(
      { success: false, message: Array.isArray(message) ? message[0] : message },
      { status: res.status },
    );
  }

  const data = body?.data ?? body;

  // 两步验证账号：透传预鉴权态，不写任何 cookie（pendingToken 由前端持有至 verify）
  if (data?.requires2fa) {
    return NextResponse.json({
      success: true,
      requires2fa: true,
      pendingToken: data.pendingToken,
      expiresIn: data.expiresIn,
    });
  }

  const { accessToken, refreshToken, user } = data;
  if (!accessToken || !refreshToken) {
    return NextResponse.json({ success: false, message: '服务端未返回令牌' }, { status: 502 });
  }

  const store = await cookies();
  const secure = isProduction;
  store.set(COOKIE.access, accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60, // access 稍长的兜底，实际有效期由 JWT exp 决定
  });
  store.set(COOKIE.refresh, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({ success: true, user });
}
