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

  // 只有在完全没有用户信息时才重定向（说明 token 完全失效）
  // permissions 为空可能是 API 临时失败，不应立即登出
  if (!session.username || !session.role) {
    console.warn("[Session] No user info detected, redirecting to login...");
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
