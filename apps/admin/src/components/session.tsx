"use client";

import { createContext, useContext } from "react";

export interface ClientSession {
  username: string;
  role: string;
  permissions: string[];
}

const SessionContext = createContext<ClientSession | null>(null);

/**
 * SessionProvider: 仅提供 session 数据给客户端组件
 * 
 * 注意：认证检查与 token 刷新均由 middleware 处理
 * 此组件只负责将 Server Component 获取的 session 传递给 Client Components
 */
export function SessionProvider({
  session,
  children,
}: {
  session: ClientSession;
  children: React.ReactNode;
}) {
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
