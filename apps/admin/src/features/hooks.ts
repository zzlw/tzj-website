'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ListResult } from '@/lib/apiClient';

type Params = Record<string, string | number | boolean | undefined | null>;

export function useList<T>(resource: string, params?: Params) {
  return useQuery<ListResult<T>>({
    queryKey: [resource, 'list', params ?? {}],
    queryFn: () => api.list<T>(resource, params),
    placeholderData: (prev) => prev, // keepPreviousData：翻页/搜索不闪烁
  });
}

export function useOne<T>(resource: string, idOrSlug: string | undefined) {
  return useQuery<T>({
    queryKey: [resource, 'detail', idOrSlug],
    queryFn: () => api.get<T>(resource, idOrSlug as string),
    enabled: Boolean(idOrSlug),
  });
}

export function useCreate<T>(resource: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) => api.create<T>(resource, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [resource] }),
  });
}

export function useUpdate<T>(resource: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: unknown }) =>
      api.update<T>(resource, id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [resource] }),
  });
}

export function useRemove(resource: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.remove(resource, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [resource] }),
  });
}
