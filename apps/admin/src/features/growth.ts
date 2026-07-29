'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';

/**
 * 增长指标（转化率看板 Phase1-MVP）数据层：
 * 类型与 apps/api/src/analytics/growth-metrics.service.ts 的响应结构逐字段对齐。
 * 历史区间后端走 T+1 进程内缓存，今日/跨今日区间实时计算。
 */

export interface ConversionMetrics {
  dateRange: { from: string; to: string };
  totalVisitors: number;
  convertedCustomers: number;
  conversionRate: number; // %
  adVisitors: number;
  adCustomers: number;
  adConversionRate: number; // %
  adInquiries: number;
  adSpend: number; // 元（Setting KV：growth.adSpend，手动录入）
  inquiryCost: number; // 元/询盘
  metricsDate: string; // ISO 8601，计算时间标记
}

export interface SupportMetrics {
  teamOverview: {
    totalRooms: number;
    convertedRooms: number;
    supportConversionRate: number; // %
    avgFirstResponseTime: number; // 分钟
  };
  agentRankings: Array<{
    maskedId: string;
    totalRooms: number;
    avgFirstResponseTime: number; // 分钟
    conversionRate: number; // %
  }>;
}

export interface ChannelFunnelRow {
  channel: string;
  funnel: { visitors: number; engaged: number; inquiries: number; customers: number };
  conversionRates: {
    visitToEngage: number;
    engageToInquiry: number;
    inquiryToCustomer: number;
    overall: number;
  };
}

type Params = Record<string, string | number | undefined>;

export function useConversionMetrics(params?: Params) {
  return useQuery<ConversionMetrics>({
    queryKey: ['growth', 'conversion-metrics', params ?? {}],
    queryFn: () => api.query<ConversionMetrics>('analytics/conversion-metrics', params),
    placeholderData: (prev) => prev,
  });
}

export function useSupportMetrics(params?: Params) {
  return useQuery<SupportMetrics>({
    queryKey: ['growth', 'support-metrics', params ?? {}],
    queryFn: () => api.query<SupportMetrics>('analytics/support-metrics', params),
    placeholderData: (prev) => prev,
  });
}

/** 渠道四层漏斗：复用 analytics/sources 端点的 detail=funnel 分支（默认近 30 天）。 */
export function useSourcesFunnel(params?: Params) {
  return useQuery<ChannelFunnelRow[]>({
    queryKey: ['growth', 'sources-funnel', params ?? {}],
    queryFn: () =>
      api.query<ChannelFunnelRow[]>('analytics/sources', { ...params, detail: 'funnel' }),
    placeholderData: (prev) => prev,
  });
}

// ── 增长看板设置（广告花费手动录入，参与询盘成本计算） ────────────────

export interface GrowthSettings {
  adSpend: number; // 元
}

export function useGrowthSettings() {
  return useQuery<GrowthSettings>({
    queryKey: ['growth', 'settings'],
    queryFn: () => api.query<GrowthSettings>('analytics/growth-settings'),
  });
}

/** 更新广告花费（需 settings.manage）：成功后刷新设置与转化指标（inquiryCost 依赖花费）。 */
export function useUpdateGrowthSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: GrowthSettings) =>
      api.put<GrowthSettings>('analytics/growth-settings', payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['growth', 'settings'] });
      void qc.invalidateQueries({ queryKey: ['growth', 'conversion-metrics'] });
    },
  });
}
