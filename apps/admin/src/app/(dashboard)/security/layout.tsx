import { requirePermission } from '@/lib/require-permission';

/** 需 security.view 或 security.manage 权限的路由布局守卫。 */
export default async function SecurityLayout({ children }: { children: React.ReactNode }) {
  await requirePermission('security.view', 'security.manage');
  return children;
}
