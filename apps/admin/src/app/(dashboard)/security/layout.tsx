import { redirect } from 'next/navigation';
import { apiFetch, getSession, hasPermission } from '@/lib/auth';

/** 需 security.view 或 security.manage 权限的路由布局守卫。 */
export default async function SecurityLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  try {
    const me = await apiFetch<{ permissions?: string[] }>('/auth/me');
    const allowed =
      hasPermission(me.permissions, 'security.view') ||
      hasPermission(me.permissions, 'security.manage');
    if (!allowed) redirect('/');
  } catch {
    redirect('/');
  }

  return children;
}
