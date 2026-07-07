"use client";

import { QueryProvider } from "./QueryProvider";
import { SessionProvider, type ClientSession } from "./session";

export function Providers({
  session,
  children,
}: {
  session: ClientSession;
  children: React.ReactNode;
}) {
  return (
    <SessionProvider session={session}>
      <QueryProvider>{children}</QueryProvider>
    </SessionProvider>
  );
}
