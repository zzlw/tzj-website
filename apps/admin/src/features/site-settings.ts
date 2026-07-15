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
