"use client";

import { QueryProvider } from "./QueryProvider";
import { SessionProvider, type ClientSession } from "./session";
import { useAuthRefresh } from "@/hooks/useAuthRefresh";

export function Providers({
  session,
  children,
}: {
  session: ClientSession;
  children: React.ReactNode;
}) {
  // 启用全局自动刷新 token（拦截 401 并自动重试）
  useAuthRefresh();

  return (
    <SessionProvider session={session}>
      <QueryProvider>{children}</QueryProvider>
    </SessionProvider>
  );
}
