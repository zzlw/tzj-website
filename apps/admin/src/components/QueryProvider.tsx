'use client';

import {
  type DefaultOptions,
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '@/lib/apiClient';
import { BASE_PATH } from '@/lib/config';

const defaultOptions: DefaultOptions = {
  queries: {
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) return false;
      return failureCount < 1;
    },
    refetchOnWindowFocus: false,
  },
};

function handleAuthError(error: unknown) {
  if (typeof window === 'undefined') return;
  if (error instanceof ApiError && error.status === 401) {
    const login = `${BASE_PATH}/login`;
    if (!window.location.pathname.endsWith('/login')) {
      window.location.href = login;
    }
  }
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions,
        queryCache: new QueryCache({ onError: handleAuthError }),
        mutationCache: new MutationCache({ onError: handleAuthError }),
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
