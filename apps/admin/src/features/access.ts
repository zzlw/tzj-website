'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccessOverview } from '@/features/types';
import { api } from '@/lib/apiClient';

export interface RoleOption {
  value: string;
  label: string;
  description?: string | null;
  system: boolean;
}

export interface CreateRolePayload {
  name: string;
  slug?: string;
  description?: string;
  permissions: string[];
}

export interface UpdateRolePayload {
  name?: string;
  description?: string;
  permissions?: string[];
}

export function useAccessOverview() {
  return useQuery({
    queryKey: ['access', 'roles'],
    queryFn: () => api.get<AccessOverview>('access', 'roles'),
  });
}

export function useRoleOptions() {
  return useQuery({
    queryKey: ['access', 'roles', 'options'],
    queryFn: () => api.get<RoleOption[]>('access', 'roles/options'),
    staleTime: 60_000,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRolePayload) => api.post<{ id: string }>('/access/roles', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['access'] });
      qc.invalidateQueries({ queryKey: ['access', 'roles', 'options'] });
    },
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateRolePayload }) =>
      api.update<unknown>('access/roles', id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['access'] });
      qc.invalidateQueries({ queryKey: ['access', 'roles', 'options'] });
    },
  });
}

export function useRemoveRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.remove('access/roles', id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['access'] });
      qc.invalidateQueries({ queryKey: ['access', 'roles', 'options'] });
    },
  });
}
