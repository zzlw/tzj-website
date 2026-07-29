import { requirePermission } from '@/lib/require-permission';

/** 需 analytics.view 权限的路由布局守卫（增长看板页面组）。 */
export default async function GrowthLayout({ children }: { children: React.ReactNode }) {
  await requirePermission('analytics.view');
  return children;
}
