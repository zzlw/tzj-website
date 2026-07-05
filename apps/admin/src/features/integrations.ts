"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type {
  IntegrationAdminItem,
  IntegrationsAdminOverview,
  IntegrationTestResult,
  UpdateIntegrationDto,
} from "@tzj/types";

export function useIntegrationsOverview() {
  return useQuery({
    queryKey: ["integrations", "admin"],
    queryFn: () => api.query<IntegrationsAdminOverview>("integrations/admin"),
  });
}

export function useUpdateIntegration(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateIntegrationDto) =>
      api.put<IntegrationAdminItem>(`integrations/${slug}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations", "admin"] }),
  });
}

export function useTestIntegration(slug: string) {
  return useMutation({
    mutationFn: () => api.post<IntegrationTestResult>(`integrations/${slug}/test`, {}),
  });
}
