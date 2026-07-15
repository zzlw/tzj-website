'use client';

import { useQuery } from '@tanstack/react-query';
import type { SystemStatusResponse } from '@tzj/types';
import { api } from '@/lib/apiClient';

export function useSystemStatus() {
  return useQuery({
    queryKey: ['system', 'status'],
    queryFn: () => api.query<SystemStatusResponse>('system/status'),
    refetchInterval: 30_000,
  });
}

export const DEPENDENCY_LABELS: Record<keyof SystemStatusResponse['dependencies'], string> = {
  database: 'PostgreSQL',
  storage: '对象存储',
  redis: 'Redis',
  email: '邮件服务',
};

export function dependencyStatusLabel(status: string): string {
  switch (status) {
    case 'up':
      return '正常';
    case 'down':
      return '异常';
    case 'degraded':
      return '降级';
    case 'skipped':
      return '未启用';
    default:
      return status;
  }
}

export function dependencyStatusClass(status: string): string {
  switch (status) {
    case 'up':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'down':
      return 'text-red-700 bg-red-50 border-red-200';
    case 'degraded':
      return 'text-amber-700 bg-amber-50 border-amber-200';
    default:
      return 'text-muted-foreground bg-muted/50 border-border';
  }
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d} 天 ${h} 小时`;
  if (h > 0) return `${h} 小时 ${m} 分钟`;
  return `${m} 分钟`;
}
