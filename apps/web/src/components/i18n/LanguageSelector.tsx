'use client';

import dynamic from 'next/dynamic';
import { createContext, useCallback, useContext, useState } from 'react';

const LanguageSelectorDrawer = dynamic(
  () =>
    import('./LanguageSelectorDrawer').then((m) => ({
      default: m.LanguageSelectorDrawer,
    })),
  { ssr: false },
);

interface LanguageSelectorContextValue {
  open: () => void;
  close: () => void;
}

const LanguageSelectorContext = createContext<LanguageSelectorContextValue | null>(null);

export function LanguageSelectorProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const value = {
    open: useCallback(() => setOpen(true), []),
    close: useCallback(() => setOpen(false), []),
  };

  return (
    <LanguageSelectorContext.Provider value={value}>
      {children}
      <LanguageSelectorDrawer open={open} onOpenChange={setOpen} />
    </LanguageSelectorContext.Provider>
  );
}

export function useLanguageSelector() {
  const ctx = useContext(LanguageSelectorContext);
  if (!ctx) {
    throw new Error('useLanguageSelector must be used within LanguageSelectorProvider');
  }
  return ctx;
}
