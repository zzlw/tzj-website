import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { API_BASE, COOKIE } from '@/lib/config';
import { retryFetch } from '@/lib/fetch-retry';
import { forwardMetaHeaders } from '@/lib/forward-meta';
import { applyTokenCookies, refreshAccessToken } from '@/lib/tokenRefresh';

async function proxy(req: NextRequest, path: string[]) {
  const store = await cookies();
  let accessToken = store.get(COOKIE.access)?.value;
  const refreshToken = store.get(COOKIE.refresh)?.value;

  const search = req.nextUrl.search || '';
  const target = `${API_BASE}/${path.join('/')}${search}`;

  const method = req.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);
  const rawBody = hasBody ? await req.text() : undefined;

  const forward = (bearer?: string) =>
    retryFetch(target, {
      method,
      headers: {
        'Content-Type': req.headers.get('content-type') || 'application/json',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        // 透传真实客户端 IP/UA，供 API 侧审计与限流取到浏览器而非 BFF 地址
        ...forwardMetaHeaders(req),
      },
      body: rawBody,
      cache: 'no-store',
    }); // 仅 GET/HEAD/OPTIONS 自动重试，写操作不重试

  let apiRes: Response;
  let rotated = null;

  try {
    apiRes = await forward(accessToken);

    if (apiRes.status === 401) {
      rotated = await refreshAccessToken(refreshToken);
      if (rotated) {
        accessToken = rotated.accessToken;
        apiRes = await forward(accessToken);
      }
    }
  } catch {
    // 上游 API 不可达（滚动重启/网络瞬断）：返回可判别的 502 JSON，
    // 避免 fetch 异常未捕获变成 Next 500 HTML，前端轮询可据此退避重试
    return NextResponse.json(
      {
        success: false,
        error: { code: 'UPSTREAM_UNAVAILABLE', message: '服务暂时不可用，请稍后重试' },
      },
      { status: 502 },
    );
  }

  const text = await apiRes.text();
  const res = new NextResponse(text, {
    status: apiRes.status,
    headers: {
      'content-type': apiRes.headers.get('content-type') || 'application/json',
    },
  });

  if (rotated) {
    applyTokenCookies(res, rotated);
  }

  return res;
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { path } = await params;
  return proxy(req, path);
}
export async function POST(req: NextRequest, { params }: Ctx) {
  const { path } = await params;
  return proxy(req, path);
}
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { path } = await params;
  return proxy(req, path);
}
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { path } = await params;
  return proxy(req, path);
}
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { path } = await params;
  return proxy(req, path);
}
