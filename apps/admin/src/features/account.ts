'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthProfile } from '@/features/types';
import { api } from '@/lib/apiClient';

export interface SessionItem {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

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

export function useSessions() {
  return useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: () => api.query<SessionItem[]>('auth/sessions'),
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => api.del<{ success: boolean }>(`/auth/sessions/${sessionId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth', 'sessions'] }),
  });
}

export function useRevokeOtherSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (refreshToken?: string) =>
      api.del<{ success: boolean }>('/auth/sessions', { refreshToken }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth', 'sessions'] }),
  });
}
