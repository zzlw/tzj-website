'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdSpendListResponse, AdSpendRecord, AdSpendRecordDto } from '@tzj/types';
import type { ContentOperatorUser } from '@/features/types';
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
  adSpend: number; // 元（台账区间分摊聚合，docs/ad-spend-ledger-design.md §4）
  adSpendByPlatform: Array<{ platform: AdSpendRecord['platform']; spend: number }>;
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
    /** 脱敏 ID（如 ***3）：账号已删除等查不到 agentUser 时的兜底展示 */
    maskedId: string;
    /** 坐席账号信息（供 hover 资料卡展示） */
    agentUser?: ContentOperatorUser | null;
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

// ── 广告花费台账（分平台分时段记账，参与询盘成本计算） ────────────────

export type { AdSpendListResponse, AdSpendRecord, AdSpendRecordDto };

/** 台账列表 + 区间分摊聚合（后端缺省近 365 天） */
export function useAdSpendRecords(params?: Params) {
  return useQuery<AdSpendListResponse>({
    queryKey: ['growth', 'ad-spend', params ?? {}],
    queryFn: () => api.query<AdSpendListResponse>('analytics/ad-spend', params),
    placeholderData: (prev) => prev,
  });
}

/** 台账写操作后统一刷新：列表 + 转化指标（inquiryCost/adSpend 依赖台账） */
function useInvalidateGrowth() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['growth'] });
  };
}

export function useCreateAdSpend() {
  const invalidate = useInvalidateGrowth();
  return useMutation({
    mutationFn: (payload: AdSpendRecordDto) =>
      api.post<AdSpendRecord>('analytics/ad-spend', payload),
    onSuccess: invalidate,
  });
}

export function useUpdateAdSpend() {
  const invalidate = useInvalidateGrowth();
  return useMutation({
    mutationFn: ({ id, ...payload }: AdSpendRecordDto & { id: string }) =>
      api.put<AdSpendRecord>(`analytics/ad-spend/${id}`, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteAdSpend() {
  const invalidate = useInvalidateGrowth();
  return useMutation({
    mutationFn: (id: string) => api.del<{ id: string }>(`analytics/ad-spend/${id}`),
    onSuccess: invalidate,
  });
}
