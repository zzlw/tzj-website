import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { Providers } from "@/components/Providers";
import { apiFetch, getSession } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware 已确保有 token，这里只需获取 session 和权限
  const session = await getSession();
  if (!session) redirect("/login");

  // 从 API 获取最新权限（middleware 已保证 token 有效）
  let permissions: string[] = [];
  try {
    const me = await apiFetch<{ permissions?: string[] }>('/auth/me');
    permissions = me.permissions ?? [];
  } catch (error) {
    // API 临时失败，使用 fallback：超级管理员拥有所有权限
    console.warn('[Dashboard] Failed to fetch permissions from /auth/me:', error);
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
