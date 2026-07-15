'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthProfile } from '@/features/types';
import { api } from '@/lib/apiClient';

export function useProfile() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get<AuthProfile>('auth', 'me'),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { nickname?: string; email?: string; phone?: string }) =>
      api.patch<AuthProfile>('/auth/me', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth', 'me'] }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: { currentPassword: string; newPassword: string }) =>
      api.patch<{ success: boolean }>('/auth/password', payload),
  });
}
