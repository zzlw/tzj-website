import { redirect } from "next/navigation";
import { apiFetch, getSession, hasPermission } from "@/lib/auth";

export default async function DocumentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  try {
    const me = await apiFetch<{ permissions?: string[] }>("/auth/me");
    if (!hasPermission(me.permissions, "docs.view")) redirect("/");
  } catch {
    redirect("/");
  }

  return children;
}
