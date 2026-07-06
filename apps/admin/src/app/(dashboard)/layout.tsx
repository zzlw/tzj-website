import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { Providers } from "@/components/Providers";
import { apiFetch, getSession } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  // 尝试从 API 获取最新权限，失败时使用 JWT 中的角色作为 fallback
  let permissions: string[] = session.permissions ?? [];
  try {
    const me = await apiFetch<{ permissions?: string[] }>('/auth/me');
    permissions = me.permissions ?? permissions;
    
    // 如果 API 返回空权限但用户是超级管理员，可能是后端数据问题
    if (permissions.length === 0 && session.role === 'admin') {
      console.error('[Dashboard] Admin user has no permissions from /auth/me');
      // admin 角色默认拥有所有权限（fallback）
      permissions = ['*'];
    }
  } catch (error) {
    // JWT 会话仍可用，权限由 API 再次校验
    console.warn('[Dashboard] Failed to fetch permissions from /auth/me:', error);
    // 如果是超级管理员，给予全部权限作为 fallback
    if (session.role === 'admin') {
      permissions = ['*'];
    }
  }

  const roleLabels: Record<string, string> = { admin: "超级管理员" };

  return (
    <Providers
      session={{
        username: session.username,
        role: session.role,
        permissions,
      }}
    >
      <DashboardShell
        username={session.username}
        roleLabel={roleLabels[session.role] ?? session.role}
      >
        {children}
      </DashboardShell>
    </Providers>
  );
}
