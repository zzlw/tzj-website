'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AnalyticsIpTrafficRow,
  BlockedIpItem,
  BlockIpDuration,
  CreateBlockedIpDto,
} from '@tzj/types';
import { api, type ListResult } from '@/lib/apiClient';

export function useSecurityIpTraffic(params?: Record<string, string | number | undefined>) {
  return useQuery<ListResult<AnalyticsIpTrafficRow>>({
    queryKey: ['security', 'ip-traffic', params ?? {}],
    queryFn: () => api.list<AnalyticsIpTrafficRow>('security/ip-traffic', params),
    placeholderData: (prev) => prev,
  });
}

export function useBlockedIps(params?: Record<string, string | number | undefined>) {
  return useQuery<ListResult<BlockedIpItem>>({
    queryKey: ['security', 'blocked-ips', params ?? {}],
    queryFn: () => api.list<BlockedIpItem>('security/blocked-ips', params),
    placeholderData: (prev) => prev,
  });
}

export function useBlockIp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBlockedIpDto) =>
      api.post<BlockedIpItem>('security/blocked-ips', payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['security', 'blocked-ips'] });
    },
  });
}

export function useUnblockIp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.remove('security/blocked-ips', id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['security', 'blocked-ips'] });
    },
  });
}

export const BLOCK_DURATION_OPTIONS: { value: BlockIpDuration; label: string }[] = [
  { value: '1h', label: '1 小时' },
  { value: '24h', label: '24 小时' },
  { value: '7d', label: '7 天' },
  { value: '30d', label: '30 天' },
  { value: 'permanent', label: '永久' },
];

export function formatBlockedExpiry(item: BlockedIpItem): string {
  if (item.isPermanent) return '永久';
  if (!item.expiresAt) return '—';
  const d = new Date(item.expiresAt);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('zh-CN');
}

export function formatLastSeen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
