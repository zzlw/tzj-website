'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SitePublicSettings } from '@tzj/types';
import { api } from '@/lib/apiClient';

export function useSitePublicSettings() {
  return useQuery({
    queryKey: ['settings', 'site', 'public'],
    queryFn: () => api.query<SitePublicSettings>('settings/site/public/admin'),
  });
}

export function useUpdateSitePublicSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SitePublicSettings) =>
      api.put<SitePublicSettings>('settings/site/public', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'site', 'public'] }),
  });
}

/** 官网设置缓存 TTL（秒）查询 */
export function useCacheTtl() {
  return useQuery({
    queryKey: ['settings', 'cache-ttl'],
    queryFn: () => api.query<{ ttl: number }>('settings/cache-ttl/admin'),
  });
}

/** 更新官网设置缓存 TTL（秒，0 = 不缓存每次实时读取） */
export function useUpdateCacheTtl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ttl: number) => api.put<{ ttl: number }>('settings/cache-ttl', { ttl }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'cache-ttl'] }),
  });
}
