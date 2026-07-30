import { requirePermission } from '@/lib/require-permission';

/** 需 lingxi.use 权限的路由布局守卫（与 Sidebar anyPerm 过滤对齐）。 */
export default async function LingxiLayout({ children }: { children: React.ReactNode }) {
  await requirePermission('lingxi.use');
  return children;
}
