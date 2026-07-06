"use client";

import { createContext, useContext } from "react";
import { useRouter } from "next/navigation";

export interface ClientSession {
  username: string;
  role: string;
  permissions: string[];
}

const SessionContext = createContext<ClientSession | null>(null);

export function SessionProvider({
  session,
  children,
}: {
  session: ClientSession;
  children: React.ReactNode;
}) {
  const router = useRouter();

  // 如果 permissions 为空且不是访客角色，说明 session 可能已失效
  if (session.permissions.length === 0 && session.role !== "guest") {
    console.warn("[Session] Empty permissions detected, redirecting to login...");
    // 延迟重定向，避免渲染闪烁
    setTimeout(() => {
      router.replace("/login?reason=session_expired");
    }, 100);
    return null;
  }

  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): ClientSession {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    return { username: "", role: "admin", permissions: [] };
  }
  return ctx;
}
