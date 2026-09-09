import type { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const response = intlMiddleware(request);

  // next-intl 中间件的 locale 补前缀跳转（/ → /zh-CN）硬编码为 307 临时跳转，
  // 对搜索引擎的权重传递信号弱于永久跳转；按官方认可做法（next-intl
  // issue #591 / discussion #544）在此将其改写为 308。
  // 另加 no-store：跳转目标随用户 cookie/Accept-Language 变化，
  // 若被浏览器永久缓存，切换语言后访问 / 仍会被旧跳转劫持。
  if (response.status === 307 && response.headers.get('location')) {
    const headers = new Headers(response.headers);
    headers.set('cache-control', 'no-store');
    return new Response(response.body, { status: 308, headers });
  }

  // localePrefix: always，语言已在路径里。NEXT_LOCALE Set-Cookie 会让 CDN/网关
  // 把投放落地 HTML 当成不可缓存（广告还带唯一 bd_vid）。已带前缀的 200 去掉该 cookie。
  const firstSeg = request.nextUrl.pathname.split('/').filter(Boolean)[0];
  if (
    firstSeg &&
    (routing.locales as readonly string[]).includes(firstSeg) &&
    response.status === 200
  ) {
    response.headers.delete('set-cookie');
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
