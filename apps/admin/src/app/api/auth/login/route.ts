import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE, COOKIE } from "@/lib/config";

export async function POST(req: NextRequest) {
  let payload: { username?: string; password?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "请求格式错误" },
      { status: 400 },
    );
  }

  const { username, password } = payload;
  if (!username || !password) {
    return NextResponse.json(
      { success: false, message: "请输入用户名和密码" },
      { status: 400 },
    );
  }

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.error?.message || body?.message || "登录失败";
    return NextResponse.json(
      { success: false, message: Array.isArray(message) ? message[0] : message },
      { status: res.status },
    );
  }

  const data = body?.data ?? body;
  const { accessToken, refreshToken, user } = data;
  if (!accessToken || !refreshToken) {
    return NextResponse.json(
      { success: false, message: "服务端未返回令牌" },
      { status: 502 },
    );
  }

  const store = await cookies();
  const secure = process.env.NODE_ENV === "production";
  store.set(COOKIE.access, accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // access 稍长的兜底，实际有效期由 JWT exp 决定
  });
  store.set(COOKIE.refresh, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({ success: true, user });
}
