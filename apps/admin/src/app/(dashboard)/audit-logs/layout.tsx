import { requirePermission } from '@/lib/require-permission';

/** 需 audit.view 权限的路由布局守卫。 */
export default async function AuditLogsLayout({ children }: { children: React.ReactNode }) {
  await requirePermission('audit.view');
  return children;
}
