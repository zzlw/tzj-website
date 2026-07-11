import { NextRequest, NextResponse } from "next/server";
import { COOKIE } from "@/lib/config";

const PUBLIC_PATHS = ["/login", "/api/auth"];

const API_BASE =
  process.env.ADMIN_API_URL ||
  process.env.NEXT_PUBLIC_ADMIN_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000/api/v1";

/** 解码 JWT payload（不校验签名，Edge 兼容） */
function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

/** access token 是否已过期（留 30s 缓冲） */
function isTokenExpired(token: string): boolean {
  const payload = decodeJwt(token);
  if (!payload || typeof payload.exp !== "number") return true;
  return payload.exp * 1000 < Date.now() + 30_000;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  // API routes pass through (BFF handles auth internally)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const accessToken = req.cookies.get(COOKIE.access)?.value;
  const refreshToken = req.cookies.get(COOKIE.refresh)?.value;
  const hasSession = !!accessToken || !!refreshToken;
  const hasValidToken = !!accessToken && !isTokenExpired(accessToken);

  // 已登录（token 有效）访问 /login → 回到首页
  if (pathname === "/login" && hasValidToken) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // 未登录访问受保护页面 → 去登录
  if (!isPublic && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // access token 过期但有 refresh token → middleware 层刷新并持久化 cookie
  if (!isPublic && accessToken && isTokenExpired(accessToken) && refreshToken) {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (res.ok) {
        const body = await res.json();
        const data = body?.data ?? body;
        if (data?.accessToken && data?.refreshToken) {
          const response = NextResponse.next();
          const secure = process.env.NODE_ENV === "production";
          response.cookies.set(COOKIE.access, data.accessToken, {
            httpOnly: true,
            secure,
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60,
          });
          response.cookies.set(COOKIE.refresh, data.refreshToken, {
            httpOnly: true,
            secure,
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
          });
          return response;
        }
      }

      // 刷新失败 → 清 cookie 跳转登录
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("from", pathname);
      url.searchParams.set("reason", "session_expired");
      const response = NextResponse.redirect(url);
      response.cookies.delete(COOKIE.access);
      response.cookies.delete(COOKIE.refresh);
      return response;
    } catch {
      // API 不可达时放行，Server Component 会处理降级
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  // 跳过静态资源与 Next 内部路径
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|woff2?)$).*)",
  ],
};
