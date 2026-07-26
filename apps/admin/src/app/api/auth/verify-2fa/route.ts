import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { API_BASE, COOKIE } from '@/lib/config';
import { forwardMetaHeaders } from '@/lib/forward-meta';

/** 登录第二步：校验动态码/恢复码，成功后写令牌 cookie（等同原 login 成功路径） */
export async function POST(req: NextRequest) {
  let payload: { pendingToken?: string; code?: string; recoveryCode?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: '请求格式错误' }, { status: 400 });
  }

  const { pendingToken, code, recoveryCode } = payload;
  if (!pendingToken || (!code && !recoveryCode)) {
    return NextResponse.json({ success: false, message: '请输入验证码或恢复码' }, { status: 400 });
  }

  // verify 消费单用 jti 与恢复码，绝不可重试
  const res = await fetch(`${API_BASE}/auth/2fa/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...forwardMetaHeaders(req) },
    body: JSON.stringify({ pendingToken, code, recoveryCode }),
    cache: 'no-store',
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.error?.message || body?.message || '验证失败';
    return NextResponse.json(
      { success: false, message: Array.isArray(message) ? message[0] : message },
      { status: res.status },
    );
  }

  const data = body?.data ?? body;
  const { accessToken, refreshToken, user, warning } = data;
  if (!accessToken || !refreshToken) {
    return NextResponse.json({ success: false, message: '服务端未返回令牌' }, { status: 502 });
  }

  const store = await cookies();
  const secure = process.env.NODE_ENV === 'production';
  store.set(COOKIE.access, accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60,
  });
  store.set(COOKIE.refresh, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({ success: true, user, ...(warning ? { warning } : {}) });
}
