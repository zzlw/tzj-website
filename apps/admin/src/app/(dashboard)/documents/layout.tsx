import { requirePermission } from '@/lib/require-permission';

/** 需 docs.view 权限的路由布局守卫。 */
export default async function DocumentsLayout({ children }: { children: React.ReactNode }) {
  await requirePermission('docs.view');
  return children;
}
