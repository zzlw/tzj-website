"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SiteNotificationSettings } from "@tzj/types";
import { api } from "@/lib/apiClient";

export function useSiteNotificationSettings() {
  return useQuery({
    queryKey: ["settings", "site", "notifications"],
    queryFn: () => api.query<SiteNotificationSettings>("settings/site/notifications"),
  });
}

export function useUpdateSiteNotificationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SiteNotificationSettings) =>
      api.put<SiteNotificationSettings>("settings/site/notifications", payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["settings", "site", "notifications"] }),
  });
}
