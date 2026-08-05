import { isProduction } from '@tzj/env';
import { type NextRequest, NextResponse } from 'next/server';
import { COOKIE } from '@/lib/config';

const PUBLIC_PATHS = ['/login', '/api/auth'];

const API_BASE =
  process.env.ADMIN_API_URL ||
  process.env.NEXT_PUBLIC_ADMIN_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4000/api/v1';

/** 解码 JWT payload（不校验签名，Edge 兼容） */
function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

/** access token 是否已过期（留 30s 缓冲） */
function isTokenExpired(token: string): boolean {
  const payload = decodeJwt(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  return payload.exp * 1000 < Date.now() + 30_000;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // API routes pass through (BFF handles auth internally)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const accessToken = req.cookies.get(COOKIE.access)?.value;
  const refreshToken = req.cookies.get(COOKIE.refresh)?.value;
  const hasSession = !!accessToken || !!refreshToken;
  const hasValidToken = !!accessToken && !isTokenExpired(accessToken);

  // 访问 /login：token 仍有效 → 回首页；access 过期但 refresh 可续 → 自动续期后回首页
  // （被 BFF 401 硬跳或临时故障误弹到登录页时，会话未真死即可无感返回，不必重输密码）。
  if (pathname === '/login') {
    if (hasValidToken) {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
    if (refreshToken) {
      const outcome = await refreshOnce(refreshToken);
      if (outcome.ok) {
        const url = req.nextUrl.clone();
        url.pathname = req.nextUrl.searchParams.get('from') || '/';
        url.search = '';
        const response = NextResponse.redirect(url);
        setTokenCookies(response, outcome.access, outcome.refresh);
        return response;
      }
      if (!outcome.transient) {
        // 会话确认失效：清掉残留 cookie，正常展示登录页
        const response = NextResponse.next();
        response.cookies.delete(COOKIE.access);
        response.cookies.delete(COOKIE.refresh);
        return response;
      }
    }
    return NextResponse.next();
  }

  // 未登录访问受保护页面 → 去登录
  if (!isPublic && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  // access token 缺失或已过期，但有 refresh token → 在网络边界刷新并持久化 cookie。
  // 必须同时覆盖「缺失」与「过期」：cookie 在 maxAge 到期后由浏览器自动清除，
  // 此时 accessToken 为 undefined，若仅判断「已过期」会漏掉该场景。
  // 续期走 refreshOnce（按令牌隔离的单飞 + 短缓存），避免并发请求重复消耗同一个
  // refresh token 而命中后端「刷新令牌复用」检测。
  if (!isPublic && refreshToken && (!accessToken || isTokenExpired(accessToken))) {
    const outcome = await refreshOnce(refreshToken);
    if (outcome.ok) {
      // 同时写入「请求头」(供本次 RSC/layout 读取) 与「响应」(供浏览器持久化)
      return applyRefreshedTokens(req, outcome.access, outcome.refresh);
    }
    if (outcome.transient) {
      // 网络瞬断 / API 滚动重启（5xx）：令牌可能仍有效，绝不清 cookie 跳登录——
      // 那等于把临时故障升级成强制登出（旧实现「偶发要求重新登录」的主因）。
      // 放行本次请求：页面数据层可能报错，用户稍后刷新即自愈。
      return NextResponse.next();
    }
    // refresh 接口明确拒绝（会话已失效/被撤销）→ 清 cookie 跳转登录
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', pathname);
    url.searchParams.set('reason', 'session_expired');
    const response = NextResponse.redirect(url);
    response.cookies.delete(COOKIE.access);
    response.cookies.delete(COOKIE.refresh);
    return response;
  }

  return NextResponse.next();
}

type RefreshOutcome =
  | { ok: true; access: string; refresh: string }
  | { ok: false; transient: boolean };

// 单飞 + 短缓存：避免并发请求重复用同一个 refresh token 续期，
// 命中后端「刷新令牌复用」检测。10s 缓存窗口内并发的多个请求复用同一次续期结果。
// 重要：缓存与单飞锁都必须按「发起续期的 refresh token」隔离——
// 旧实现的全局 cachedPair 不校验入参，会在缓存窗口内把用户 A 的令牌对
// 发给恰好也在续期的用户 B（身份串号）。
const inflightByToken = new Map<string, Promise<RefreshOutcome>>();
let cachedPair: { forToken: string; access: string; refresh: string; exp: number } | null = null;
const REFRESH_CACHE_TTL = 10_000;

async function refreshOnce(refreshToken: string): Promise<RefreshOutcome> {
  if (cachedPair && cachedPair.forToken === refreshToken && cachedPair.exp > Date.now()) {
    return { ok: true, access: cachedPair.access, refresh: cachedPair.refresh };
  }
  const existing = inflightByToken.get(refreshToken);
  if (existing) return existing;

  const task = (async (): Promise<RefreshOutcome> => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        // 4xx = 令牌被明确拒绝（会话真失效）；5xx = 上游临时故障
        return { ok: false, transient: res.status >= 500 };
      }
      const body = await res.json().catch(() => null);
      const data = body?.data ?? body;
      if (!data?.accessToken || !data?.refreshToken) return { ok: false, transient: true };
      cachedPair = {
        forToken: refreshToken,
        access: data.accessToken,
        refresh: data.refreshToken,
        exp: Date.now() + REFRESH_CACHE_TTL,
      };
      return { ok: true, access: data.accessToken, refresh: data.refreshToken };
    } catch {
      return { ok: false, transient: true };
    } finally {
      inflightByToken.delete(refreshToken);
    }
  })();

  inflightByToken.set(refreshToken, task);
  return task;
}

/** 将令牌对写入响应 Set-Cookie（供浏览器持久化）。 */
function setTokenCookies(response: NextResponse, accessToken: string, refreshToken: string): void {
  const secure = isProduction;
  const opts = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };
  response.cookies.set(COOKIE.access, accessToken, { ...opts, maxAge: 60 * 60 });
  response.cookies.set(COOKIE.refresh, refreshToken, { ...opts, maxAge: 60 * 60 * 24 * 7 });
}

/**
 * 将续期后的令牌同时下发到：
 *  - 响应 Set-Cookie：浏览器持久化，供后续请求使用；
 *  - 请求 Cookie 头：下游 Server Component（如 (dashboard)/layout）在本次渲染即可读到新令牌，
 *    避免其再用旧（已轮换失效的）refresh token 二次续期，造成「刷新令牌复用」被整体撤销。
 */
function applyRefreshedTokens(
  req: NextRequest,
  accessToken: string,
  refreshToken: string,
): NextResponse {
  // 基于「原始」cookie 头替换两个 token，而不是 req.cookies.getAll() 解码后重拼：
  // getAll() 会对值做 decodeURIComponent，若浏览器带有 %-编码中文的 cookie
  //（如 .tzjii.com 域下的第三方 cookie），解码后写回请求头会因非 Latin-1
  // 字符抛 ByteString TypeError，导致整页 500。
  const rawCookie = req.headers.get('cookie') ?? '';
  const kept = rawCookie.split(/; */).filter((pair) => {
    if (!pair) return false;
    const eq = pair.indexOf('=');
    const name = eq === -1 ? pair : pair.slice(0, eq);
    return name !== COOKIE.access && name !== COOKIE.refresh;
  });
  const cookieHeader = [
    ...kept,
    `${COOKIE.access}=${accessToken}`,
    `${COOKIE.refresh}=${refreshToken}`,
  ].join('; ');

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('cookie', cookieHeader);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  setTokenCookies(response, accessToken, refreshToken);
  return response;
}

export const config = {
  // 跳过静态资源与 Next 内部路径
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|woff2?)$).*)',
  ],
};
