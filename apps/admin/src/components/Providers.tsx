'use client';

import { QueryProvider } from './QueryProvider';
import { type ClientSession, SessionProvider } from './session';
import { VisitorDrawerProvider } from './visitor-drawer/VisitorDrawerProvider';

export function Providers({
  session,
  children,
}: {
  session: ClientSession;
  children: React.ReactNode;
}) {
  return (
    <SessionProvider session={session}>
      <QueryProvider>
        <VisitorDrawerProvider>{children}</VisitorDrawerProvider>
      </QueryProvider>
    </SessionProvider>
  );
}
