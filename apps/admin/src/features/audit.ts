"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ListResult } from "@/lib/apiClient";
import type { AuditLogItem } from "./types";

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

export const AUDIT_ACTION_OPTIONS = [
  { value: "login", label: "登录" },
  { value: "logout", label: "登出" },
  { value: "create", label: "创建" },
  { value: "update", label: "更新" },
  { value: "delete", label: "删除" },
] as const;

export const AUDIT_RESOURCE_OPTIONS = [
  { value: "auth", label: "认证" },
  { value: "users", label: "账号" },
  { value: "access", label: "角色权限" },
  { value: "cases", label: "案例" },
  { value: "news", label: "新闻" },
  { value: "blogs", label: "博客" },
  { value: "trade-shows", label: "展会" },
  { value: "media", label: "媒体" },
  { value: "contacts", label: "询盘" },
  { value: "pages", label: "页面" },
] as const;

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_OPTIONS.find((o) => o.value === action)?.label ?? action;
}

export function auditResourceLabel(resource: string): string {
  return AUDIT_RESOURCE_OPTIONS.find((o) => o.value === resource)?.label ?? resource;
}

export function auditUserLabel(log: Pick<AuditLogItem, "user">): string {
  if (!log.user) return "—";
  return log.user.nickname?.trim() || log.user.username;
}

export function formatAuditDateTime(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("zh-CN");
}
