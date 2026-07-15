import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { API_BASE, COOKIE } from '@/lib/config';

export async function POST() {
  const store = await cookies();
  const accessToken = store.get(COOKIE.access)?.value;
  const refreshToken = store.get(COOKIE.refresh)?.value;

  // 通知 API 撤销会话（失败不阻塞登出）
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
  } catch {
    // ignore
  }

  store.delete(COOKIE.access);
  store.delete(COOKIE.refresh);
  return NextResponse.json({ success: true });
}
