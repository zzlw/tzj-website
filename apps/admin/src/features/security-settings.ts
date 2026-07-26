'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SecurityAuthSettings } from '@tzj/types';
import { api } from '@/lib/apiClient';

export function useSecurityAuthSettings() {
  return useQuery({
    queryKey: ['settings', 'security', 'auth'],
    queryFn: () => api.query<SecurityAuthSettings>('settings/security/auth'),
  });
}

export function useUpdateSecurityAuthSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SecurityAuthSettings) =>
      api.put<SecurityAuthSettings>('settings/security/auth', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'security', 'auth'] }),
  });
}
