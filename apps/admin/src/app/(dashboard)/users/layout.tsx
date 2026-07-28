import { requirePermission } from '@/lib/require-permission';

/** 需 users.manage 权限的路由布局守卫。 */
export default async function UsersLayout({ children }: { children: React.ReactNode }) {
  await requirePermission('users.manage');
  return children;
}
