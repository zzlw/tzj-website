import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { API_BASE, COOKIE } from '@/lib/config';
import { applyTokenCookies, refreshAccessToken, type TokenPair } from '@/lib/tokenRefresh';

/**
 * 灵犀流式 BFF（docs/lingxi-ai-report-design.md §7.1）。
 *
 * 通用 BFF [...path] 用 await res.text() 全量缓冲，SSE 流经它会退化为一次性吐出，
 * 故灵犀 SSE 两路（POST 发起生成 / GET 重连续播）都必须走本路由：
 * - 读 httpOnly cookie 附 Bearer 转发，token 过期在「开流前」用 refresh 轮换后重试；
 * - 直接透传上游 ReadableStream（new Response 不继承上游头，SSE 头必须在此重建）；
 * - X-Accel-Buffering: no 让 nginx 不缓冲；上游地址复用 ADMIN_API_URL（compose 内网直连）。
 */

export const dynamic = 'force-dynamic';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const;

async function openStream(
  target: string,
  init: { method: string; body?: string },
): Promise<Response> {
  const store = await cookies();
  const accessToken = store.get(COOKIE.access)?.value;
  const refreshToken = store.get(COOKIE.refresh)?.value;

  const forward = (bearer?: string) =>
    fetch(target, {
      method: init.method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: init.body,
      cache: 'no-store',
    });

  let apiRes: Response;
  let rotated: TokenPair | null = null;
  try {
    apiRes = await forward(accessToken);
    if (apiRes.status === 401) {
      rotated = await refreshAccessToken(refreshToken);
      if (rotated) {
        apiRes = await forward(rotated.accessToken);
      }
    }
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'UPSTREAM_UNAVAILABLE', message: '服务暂时不可用，请稍后重试' },
      },
      { status: 502 },
    );
  }

  // 非 200（LLM 未配置 503 / 会话不存在 404 / 并发生成 409）：上游是 JSON 错误体，原样转发
  if (!apiRes.ok || !apiRes.body) {
    const text = await apiRes.text();
    const res = new NextResponse(text, {
      status: apiRes.status,
      headers: { 'content-type': apiRes.headers.get('content-type') || 'application/json' },
    });
    if (rotated) applyTokenCookies(res, rotated);
    return res;
  }

  // 透传上游 SSE 流；轮换过 token 则趁 200 响应把新 cookie 带回浏览器
  const res = new NextResponse(apiRes.body, { status: 200, headers: SSE_HEADERS });
  if (rotated) applyTokenCookies(res, rotated);
  return res;
}

/** 发起生成：body 直传 { message, conversationId? } */
export async function POST(req: NextRequest) {
  const body = await req.text();
  return openStream(`${API_BASE}/lingxi/chat`, { method: 'POST', body });
}

/** 重连续播：?cid= 传会话 ID，重放缓冲帧并续播直到 done */
export async function GET(req: NextRequest) {
  const cid = req.nextUrl.searchParams.get('cid');
  if (!cid) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: '缺少 cid 参数' } },
      { status: 400 },
    );
  }
  return openStream(`${API_BASE}/lingxi/chat/stream/${encodeURIComponent(cid)}`, {
    method: 'GET',
  });
}
