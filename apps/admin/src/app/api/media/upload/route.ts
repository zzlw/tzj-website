import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { API_BASE, COOKIE } from '@/lib/config';
import {
  applyTokenCookies,
  refreshAccessToken,
  type TokenPair,
  UPSTREAM_UNAVAILABLE_BODY,
} from '@/lib/tokenRefresh';

/**
 * 媒体上传专用 BFF：接收 multipart/form-data，携带 httpOnly cookie 中的 Bearer
 * 转发到 Nest `/media/upload`。通用 BFF 以 text 转发会破坏二进制，故单独处理。
 */
export async function POST(req: NextRequest) {
  const store = await cookies();
  let accessToken = store.get(COOKIE.access)?.value;
  const refreshToken = store.get(COOKIE.refresh)?.value;

  const incoming = await req.formData();
  const file = incoming.get('file');
  const folder = (incoming.get('folder') as string | null) ?? 'uploads';
  const watermark = incoming.get('watermark');

  if (!(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: { message: '未接收到文件' } },
      { status: 400 },
    );
  }

  const buildForm = () => {
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('folder', folder);
    // 单次水印覆盖参数：仅透传合法值，缺省不追加（后端按 auto 处理）
    if (watermark === 'skip' || watermark === 'force') fd.append('watermark', watermark);
    return fd;
  };

  const forward = (bearer?: string) =>
    fetch(`${API_BASE}/media/upload`, {
      method: 'POST',
      headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined,
      body: buildForm(),
      cache: 'no-store',
    });

  let apiRes = await forward(accessToken);
  let rotated: TokenPair | null = null;

  if (apiRes.status === 401) {
    const refreshed = await refreshAccessToken(refreshToken);
    if (refreshed.ok) {
      rotated = refreshed.tokens;
      accessToken = rotated.accessToken;
      apiRes = await forward(accessToken);
    } else if (refreshed.transient) {
      return NextResponse.json(UPSTREAM_UNAVAILABLE_BODY, { status: 502 });
    }
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
