'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthProfile } from '@/features/types';
import { api } from '@/lib/apiClient';
import { BASE_PATH } from '@/lib/config';

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

// ── 两步验证（TOTP）───────────────────────────

export interface TwoFactorStatus {
  enabled: boolean;
  confirmedAt: string | null;
  recoveryCodesRemaining: number;
}

export interface TwoFactorSetupData {
  otpauthUri: string;
  qrDataUrl: string;
  secret: string;
  expiresAt: string;
}

export function useTwoFactorStatus() {
  return useQuery({
    queryKey: ['auth', '2fa', 'status'],
    queryFn: () => api.query<TwoFactorStatus>('auth/2fa/status'),
  });
}

export function useTwoFactorSetup() {
  return useMutation({
    mutationFn: (password: string) => api.post<TwoFactorSetupData>('/auth/2fa/setup', { password }),
  });
}

/** enable 走专门 BFF 路由（需注入 httpOnly refresh cookie 标识当前会话），不走通用 bff 代理 */
export function useTwoFactorEnable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch(`${BASE_PATH}/api/auth/2fa/enable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || body?.success === false) {
        const raw = body?.error?.message ?? body?.message ?? `请求失败 (${res.status})`;
        throw new Error(Array.isArray(raw) ? raw[0] : raw);
      }
      return (body?.data ?? body) as { recoveryCodes: string[] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth', '2fa'] }),
  });
}

export function useTwoFactorDisable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { password: string; code?: string; recoveryCode?: string }) =>
      api.post<{ success: boolean }>('/auth/2fa/disable', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth', '2fa'] }),
  });
}

export function useTwoFactorRegenerate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      api.post<{ recoveryCodes: string[] }>('/auth/2fa/recovery-codes/regenerate', { code }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth', '2fa'] }),
  });
}
