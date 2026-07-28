import { requirePermission } from '@/lib/require-permission';

/** 需 system.view 权限的路由布局守卫。 */
export default async function SystemLayout({ children }: { children: React.ReactNode }) {
  await requirePermission('system.view');
  return children;
}
