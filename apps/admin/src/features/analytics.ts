"use client";

import { useQuery } from "@tanstack/react-query";
import type { AnalyticsIpTrafficRow } from "@tzj/types";
import { api, type ListResult } from "@/lib/apiClient";

export interface AnalyticsOverview {
  summary: {
    pageViews: number;
    uniqueVisitors: number;
    pageViewsToday: number;
    uniqueVisitorsToday: number;
    from: string;
    to: string;
  };
  daily: Array<{
    date: string;
    pageViews: number;
    uniqueVisitors: number;
  }>;
  topPages: Array<{
    path: string;
    title: string | null;
    pageViews: number;
    uniqueVisitors: number;
  }>;
  topReferrers: Array<{
    referrerHost: string;
    region: string;
    geoSource: string;
    pageViews: number;
  }>;
  topRegions: Array<{
    region: string;
    geoSource: string;
    pageViews: number;
    uniqueVisitors: number;
  }>;
  devices: Array<{ deviceType: string; count: number }>;
  browsers: Array<{ browser: string; count: number }>;
}

export interface AnalyticsPageRow {
  id: string;
  path: string;
  title: string | null;
  pageViews: number;
  uniqueVisitors: number;
}

export interface AnalyticsRegionRow {
  id: string;
  region: string;
  geoSource: string;
  pageViews: number;
  uniqueVisitors: number;
}

export interface AnalyticsReferrerRow {
  id: string;
  referrerHost: string;
  region: string;
  geoSource: string;
  pageViews: number;
}

type Params = Record<string, string | number | undefined>;

export function useAnalyticsOverview(params?: Params) {
  return useQuery<AnalyticsOverview>({
    queryKey: ["analytics", "overview", params ?? {}],
    queryFn: () => api.query<AnalyticsOverview>("analytics/overview", params),
    placeholderData: (prev) => prev,
  });
}

export function useAnalyticsPages(params?: Params) {
  return useQuery<ListResult<AnalyticsPageRow>>({
    queryKey: ["analytics", "pages", params ?? {}],
    queryFn: () => api.list<AnalyticsPageRow>("analytics/pages", params),
    placeholderData: (prev) => prev,
  });
}

export function useAnalyticsRegions(params?: Params) {
  return useQuery<ListResult<AnalyticsRegionRow>>({
    queryKey: ["analytics", "regions", params ?? {}],
    queryFn: () => api.list<AnalyticsRegionRow>("analytics/regions", params),
    placeholderData: (prev) => prev,
  });
}

export function useAnalyticsReferrers(params?: Params) {
  return useQuery<ListResult<AnalyticsReferrerRow>>({
    queryKey: ["analytics", "referrers", params ?? {}],
    queryFn: () => api.list<AnalyticsReferrerRow>("analytics/referrers", params),
    placeholderData: (prev) => prev,
  });
}

export function useAnalyticsIpTraffic(params?: Params) {
  return useQuery<ListResult<AnalyticsIpTrafficRow>>({
    queryKey: ["analytics", "ip-traffic", params ?? {}],
    queryFn: () => api.list<AnalyticsIpTrafficRow>("analytics/ip-traffic", params),
    placeholderData: (prev) => prev,
  });
}

export function formatLastSeen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const DEVICE_LABELS: Record<string, string> = {
  desktop: "桌面端",
  mobile: "移动端",
  tablet: "平板",
  unknown: "未知",
};

export function deviceLabel(v: string): string {
  return DEVICE_LABELS[v] ?? v;
}

export function formatShortDate(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

export const DEFAULT_PAGE_SORT = { column: "pageViews", order: "desc" as const };
export const DEFAULT_REGION_SORT = { column: "pageViews", order: "desc" as const };
export const DEFAULT_REFERRER_SORT = { column: "pageViews", order: "desc" as const };
