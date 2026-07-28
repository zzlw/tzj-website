import { redirect } from 'next/navigation';
import { ApiError, apiFetch, getSession, hasPermission } from './auth';

/**
 * 服务端路由布局守卫：校验会话与权限（任一命中即放行）。
 * - 无会话 / 令牌失效（401）→ 跳登录页
 * - 权限不足 → 跳首页
 * - API 不可用等其他失败 → 抛错交给 error boundary 展示真实原因，避免误判为无权限被静默踢回首页
 */
export async function requirePermission(...perms: string[]): Promise<void> {
  const session = await getSession();
  if (!session) redirect('/login');

  let permissions: string[] | undefined;
  try {
    const me = await apiFetch<{ permissions?: string[] }>('/auth/me');
    permissions = me.permissions;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`权限校验失败：无法访问 API（${detail}）。请确认 API 服务是否已启动。`);
  }

  if (!perms.some((p) => hasPermission(permissions, p))) redirect('/');
}
