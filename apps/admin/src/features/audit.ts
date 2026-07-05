"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ListResult } from "@/lib/apiClient";
import type { AuditLogItem } from "./types";

export {
  AUDIT_ACTION_OPTIONS,
  AUDIT_RESOURCE_OPTIONS,
  auditActionLabel,
  auditResourceLabel,
  auditUserLabel,
  formatAuditDateTime,
} from "./audit-labels";

type Params = Record<string, string | number | undefined>;

export function useAuditLogList(params?: Params) {
  return useQuery<ListResult<AuditLogItem>>({
    queryKey: ["audit-logs", "list", params ?? {}],
    queryFn: () => api.list<AuditLogItem>("audit-logs", params),
    placeholderData: (prev) => prev,
  });
}

export function useAuditLog(id: string | null) {
  return useQuery({
    queryKey: ["audit-logs", "detail", id],
    queryFn: () => api.get<AuditLogItem>("audit-logs", id!),
    enabled: Boolean(id),
  });
}
