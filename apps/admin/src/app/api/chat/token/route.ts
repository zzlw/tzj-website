import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { API_BASE, COOKIE } from '@/lib/config';
import { forwardMetaHeaders } from '@/lib/forward-meta';

/**
 * 坐席 chat token BFF（P0 C1）。
 *
 * 浏览器无法读取 httpOnly 的 access cookie，故由服务端路由代为向聊天 API 兑换
 * 作用域为 chat 的短令牌；该令牌仅用于 Socket.IO 握手鉴权，无法用于业务接口。
 * 失败（无会话/令牌过期）返回 401，由前端引导重新登录。
 */
export async function POST(req: NextRequest) {
  const store = await cookies();
  const accessToken = store.get(COOKIE.access)?.value;
  if (!accessToken) {
    return Response.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const res = await fetch(`${API_BASE}/chat-rooms/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        // 透传真实客户端 IP/UA，供 API 侧按浏览器 IP 限流，避免 BFF 共享桶被打满
        ...forwardMetaHeaders(req),
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      return Response.json({ error: '令牌兑换失败' }, { status: res.status });
    }
    // API 统一响应体被全局拦截器包了一层 { success, traceId, timestamp, data }，
    // 这里取下钻的 data（即 chat token 本体 { token, email, role }）再原样返回，
    // 否则前端按 data.token 取到的会是 undefined，导致 socket 握手无令牌而掉线。
    const body = (await res.json()) as {
      data?: { token: string; email: string; role: string };
    };
    if (!body.data?.token) {
      return Response.json({ error: '令牌兑换失败' }, { status: res.status });
    }
    return Response.json(body.data, { status: 200 });
  } catch {
    return Response.json({ error: '聊天服务不可用' }, { status: 502 });
  }
}
