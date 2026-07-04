import { redirect } from "next/navigation";
import { apiFetch, getSession, hasPermission } from "@/lib/auth";

/** 需 users.manage 权限的路由布局守卫。 */
export default async function AdminOnlyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  try {
    const me = await apiFetch<{ permissions?: string[] }>("/auth/me");
    if (!hasPermission(me.permissions, "users.manage")) {
      redirect("/");
    }
  } catch {
    redirect("/");
  }

  return children;
}
