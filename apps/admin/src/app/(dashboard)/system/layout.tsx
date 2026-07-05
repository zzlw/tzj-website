import { redirect } from "next/navigation";
import { apiFetch, getSession, hasPermission } from "@/lib/auth";

export default async function SystemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  try {
    const me = await apiFetch<{ permissions?: string[] }>("/auth/me");
    if (!hasPermission(me.permissions, "system.view")) redirect("/");
  } catch {
    redirect("/");
  }

  return children;
}
