import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { API_BASE, COOKIE } from '@/lib/config';
import { applyTokenCookies, refreshAccessToken } from '@/lib/tokenRefresh';

/**
 * Favicon 上传专用 BFF：接收 multipart/form-data，携带 httpOnly cookie 转发到 Nest API。
 * POST  /api/site-settings/favicon  →  Nest  POST  /site-settings/favicon
 */
export async function POST(req: NextRequest) {
  const store = await cookies();
  let accessToken = store.get(COOKIE.access)?.value;
  const refreshToken = store.get(COOKIE.refresh)?.value;

  const incoming = await req.formData();
  const file = incoming.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: { message: '未接收到文件' } },
      { status: 400 },
    );
  }

  const buildForm = () => {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return fd;
  };

  const forward = (bearer?: string) =>
    fetch(`${API_BASE}/site-settings/favicon`, {
      method: 'POST',
      headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined,
      body: buildForm(),
      cache: 'no-store',
    });

  let apiRes = await forward(accessToken);
  let rotated = null;

  if (apiRes.status === 401) {
    rotated = await refreshAccessToken(refreshToken);
    if (rotated) {
      accessToken = rotated.accessToken;
      apiRes = await forward(accessToken);
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

/**
 * DELETE  /api/site-settings/favicon  →  Nest  DELETE  /site-settings/favicon
 */
export async function DELETE() {
  const store = await cookies();
  let accessToken = store.get(COOKIE.access)?.value;
  const refreshToken = store.get(COOKIE.refresh)?.value;

  const forward = (bearer?: string) =>
    fetch(`${API_BASE}/site-settings/favicon`, {
      method: 'DELETE',
      headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined,
      cache: 'no-store',
    });

  let apiRes = await forward(accessToken);
  let rotated = null;

  if (apiRes.status === 401) {
    rotated = await refreshAccessToken(refreshToken);
    if (rotated) {
      accessToken = rotated.accessToken;
      apiRes = await forward(accessToken);
    }
  }

  const res = new NextResponse(null, { status: apiRes.status });

  if (rotated) {
    applyTokenCookies(res, rotated);
  }

  return res;
}
