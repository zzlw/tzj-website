import { NextRequest, NextResponse } from "next/server";
import { COOKIE } from "@/lib/config";

const PUBLIC_PATHS = ["/login", "/api/auth", "/vditor-assets"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  const hasSession =
    req.cookies.has(COOKIE.access) || req.cookies.has(COOKIE.refresh);

  // 已登录访问 /login → 回到首页
  if (pathname === "/login" && hasSession) {
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

  return NextResponse.next();
}

export const config = {
  // 跳过静态资源与 Next 内部路径
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|vditor-assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|woff2?)$).*)",
  ],
};
