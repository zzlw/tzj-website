"use client";

import { createContext, useContext } from "react";

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
