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

  let permissions: string[] = session.permissions ?? [];
  try {
    const me = await apiFetch<{ permissions?: string[] }>("/auth/me");
    permissions = me.permissions ?? permissions;
  } catch {
    // JWT 会话仍可用，权限由 API 再次校验
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
