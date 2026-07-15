'use client';

import type { ReactNode } from 'react';
import { useSession } from './session';

/**
 * 客户端 UI 门禁：按权限或角色 slug 控制渲染。
 * 真正的权限仍由 API 的 RolesGuard 强制。
 */
export function Can({
  allow,
  perm,
  anyPerm,
  children,
  fallback = null,
}: {
  /** 允许的角色 slug 列表（如 admin） */
  allow?: string[];
  /** 需要具备的单一权限 */
  perm?: string;
  /** 具备其中任一权限即可 */
  anyPerm?: string[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { role, permissions } = useSession();

  if (perm && permissions.includes(perm)) return <>{children}</>;
  if (anyPerm?.some((p) => permissions.includes(p))) return <>{children}</>;
  if (allow?.includes(role)) return <>{children}</>;

  return <>{fallback}</>;
}
