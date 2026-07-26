import type { NextRequest } from 'next/server';

/**
 * BFF → NestJS 转发时透传真实客户端元信息。
 * API 侧仅在直连方为受信代理（回环/私有网段）时才采信 XFF（见 apps/api client-ip.ts），
 * BFF 与 API 同机/同内网部署，透传后审计日志与限流均可取到真实浏览器 IP。
 */
export function forwardMetaHeaders(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  const xff = req.headers.get('x-forwarded-for');
  if (xff) headers['X-Forwarded-For'] = xff;
  const ua = req.headers.get('user-agent');
  if (ua) headers['User-Agent'] = ua;
  return headers;
}
