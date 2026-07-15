'use client';

import { QueryProvider } from './QueryProvider';
import { type ClientSession, SessionProvider } from './session';

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
