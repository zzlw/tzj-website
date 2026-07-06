import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE } from './lib/config';

/**
 * Middleware: 统一处理后台管理系统的认证检查
 * 
 * 职责：
 * 1. 检查 access token cookie 是否存在
 * 2. 无 token → 重定向到登录页
 * 3. 有 token → 放行，让页面自己处理权限和自动刷新
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 排除不需要认证的路径
  const publicPaths = ['/login', '/api'];
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }
  
  // 检查 access token
  const accessToken = request.cookies.get(COOKIE.access)?.value;
  
  // 没有 access token → 重定向到登录页
  if (!accessToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('reason', 'no_token');
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  // 有 token → 放行（客户端会自动处理过期和刷新）
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径除了：
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico (网站图标)
     * - api/* (API 路由)
     * - login (登录页)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|login).*)',
  ],
};
