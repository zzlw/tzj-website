import { requirePermission } from '@/lib/require-permission';

/** 需 analytics.view 权限的路由布局守卫。 */
export default async function VisitorsLayout({ children }: { children: React.ReactNode }) {
  await requirePermission('analytics.view');
  return children;
}
