'use client';

import { useQuery } from '@tanstack/react-query';
import type { AnalyticsIpTrafficRow } from '@tzj/types';
import type { Granularity } from '@/lib/analytics-granularity';
import { api, type ListResult } from '@/lib/apiClient';

export interface AnalyticsOverview {
  /** 后端实际采用的趋势粒度（可能因非法/缺省被回落）；供前端标轴与控件高亮。 */
  granularity: Granularity;
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
  /** 版本级浏览器明细：供前端按兼容性基线离线归类为 支持/不支持/未知。 */
  browserVersions: Array<{ browser: string; browserVersion: string | null; count: number }>;
}

export interface AnalyticsSources {
  channels: Array<{ source: string; pageViews: number; uniqueVisitors: number }>;
  topCampaigns: Array<{
    campaign: string;
    source: string;
    medium: string;
    pageViews: number;
    uniqueVisitors: number;
  }>;
  topSources: Array<{ source: string; pageViews: number; uniqueVisitors: number }>;
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

/**
 * 按 IP 聚合的访客明细行（合并地区/IP/来源/设备多维度）。
 * region 为读取时重解析的精确地址；isp 为运营商（纯真库，可空）。
 * channel/source/medium/landingPath 为首触归因（获客入口），device/browser/os 为最近一次。
 */
export interface AnalyticsVisitorDetailRow {
  id: string;
  ip: string | null;
  ipMasked: string | null;
  region: string;
  isp: string | null;
  geoSource: string;
  referrerHost: string;
  channel: string | null;
  source: string | null;
  medium: string | null;
  deviceType: string | null;
  deviceModel: string | null;
  deviceVendor: string | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  clientApp: string | null;
  landingPath: string | null;
  pageViews: number;
  sessions: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface AnalyticsVisitorRow {
  id: string;
  visitorId: string;
  userId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  identified: boolean;
  identifiedAt: string | null;
  pageViews: number;
  sessions: number;
  firstSeenAt: string;
  lastSeenAt: string;
  landingPath: string;
  deviceType: string;
  country: string;
  channel: string | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  deviceModel: string | null;
  deviceVendor: string | null;
  clientApp: string | null;
  region: string | null;
  city: string | null;
  /** 最后一次访问的 IP（环境维度：定位/网络/风控），下钻可开 IP 抽屉 */
  lastIp: string | null;
  lastIpMasked: string | null;
  lastIpHash: string | null;
  referrerHost: string | null;
  /** 营销归因（会话首触）：UTM 五参数 + 广告点击 ID（gclid/bd_vid） */
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  gclid: string | null;
  bdVid: string | null;
  touchedContact?: boolean;
  touchedCase?: boolean;
  /** 最近一条询盘 ID（转化去重锚点，无询盘为 null） */
  latestContactId?: string | null;
  /** 已转客户 ID（询盘/访客两条归因链路任一命中；未转化为 null） */
  convertedCustomerId?: string | null;
}

/**
 * 「按访客」全量导出行：列表行 + 转化标签（后端 Contact/Customer 反查），
 * 供 CSV 导出给 AI 做投放归因与用户画像分析。
 */
export interface AnalyticsVisitorExportRow extends AnalyticsVisitorRow {
  inquirySubmitted: boolean;
  inquiredAt: string | null;
  convertedCustomer: boolean;
  /** 首访至询盘天数（1 位小数，未询盘为 null） */
  daysToInquiry: number | null;
}

export interface AnalyticsVisitorActivityView {
  path: string;
  title: string | null;
  createdAt: string;
}

/**
 * 该访客用过的网络/地区（按 ipHash 去重）：反映「同一个人换了 IP/网络」（visitorId 不变、IP 变）。
 * 用 CookieID 认「是谁」、IP 认「在哪」，此处即人物轴下汇总的历史「在哪」。
 */
export interface AnalyticsVisitorNetwork {
  /** 明文 IP（内部后台明文展示，无则回退 ipMasked） */
  ip: string | null;
  ipMasked: string | null;
  region: string;
  pageViews: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface AnalyticsVisitorSession {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  pageCount: number;
  channel: string | null;
  referrerHost: string | null;
  deviceType: string | null;
  deviceModel: string | null;
  deviceVendor: string | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  clientApp: string | null;
  views: AnalyticsVisitorActivityView[];
}

export interface AnalyticsVisitorActivity {
  visitorId: string;
  /** 仅凭 visitorId 渲染人物抽屉头部的身份块（人物抽屉返回；IP 抽屉为 undefined） */
  identity?: VisitorIdentityBlock;
  sessions: AnalyticsVisitorSession[];
  /** 该访客跨 IP 的历史网络/地区（仅按 visitorId 的人物抽屉返回；IP 抽屉为 undefined） */
  networks?: AnalyticsVisitorNetwork[];
  techInfo: {
    deviceType: string | null;
    deviceModel: string | null;
    deviceVendor: string | null;
    browser: string | null;
    browserVersion: string | null;
    os: string | null;
    osVersion: string | null;
    clientApp: string | null;
    region: string | null;
    city: string | null;
    country: string | null;
    channel: string | null;
    referrerHost: string | null;
  };
  /** 营销归因（首触）：UTM 五参数 + gclid/bd_vid + 落地页；仅人物抽屉返回，IP 抽屉为 undefined */
  attribution?: {
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmContent: string | null;
    utmTerm: string | null;
    gclid: string | null;
    bdVid: string | null;
    landingPath: string | null;
  };
  summary: {
    totalPageViews: number;
    totalSessions: number;
    firstSeenAt: string | null;
    lastSeenAt: string | null;
    touchedContact: boolean;
    touchedCase: boolean;
  };
}

/**
 * 同一 IP 下去重的关联访客（IP↔访客多对多：NAT/共享网络一个 IP 可能对应多人）。
 * 供访客明细 IP 抽屉「关联访客」桥跳转，点击后按 visitorId 打开完整人物抽屉。
 */
export interface AnalyticsRelatedVisitor {
  visitorId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  identified: boolean;
  pageViews: number;
}

/** IP 维度时间线：在访客时间线基础上附带该 IP 关联访客列表（身份桥）。 */
export interface AnalyticsIpActivity extends AnalyticsVisitorActivity {
  relatedVisitors: AnalyticsRelatedVisitor[];
  /** 仅凭 ipHash 渲染 IP 抽屉头部的地区/ISP 块（无代表行时为 null） */
  header?: IpDrawerSeed | null;
}

/**
 * IP 抽屉打开前的标题占位种子：加载完成后由 activity.header 覆盖。
 * AnalyticsVisitorDetailRow 满足此形状，供「按 IP」lens 直接透传。
 */
export interface IpDrawerSeed {
  ip: string | null;
  ipMasked: string | null;
  region: string;
  isp: string | null;
  geoSource: string;
}

/**
 * 人物抽屉「询盘」tab 列表项：来自 Contact 表，按 visitorId 归并。
 * convertedCustomerId 非空表示该询盘已转为客户线索。
 */
export interface AnalyticsVisitorInquiry {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  subject: string | null;
  message: string;
  createdAt: string;
  isRead: boolean;
  isHandled: boolean;
  convertedCustomerId: string | null;
}

/**
 * 人物抽屉 (VisitorProfileSheet) 所需的最小身份契合类型。
 * AnalyticsVisitorRow 与 AnalyticsRelatedVisitor 均可满足，供 IP 桥跳转复用抽屉。
 */
export type VisitorProfileIdentity = Pick<
  AnalyticsVisitorRow,
  'visitorId' | 'name' | 'email' | 'phone' | 'company' | 'identified'
>;

/**
 * 人物抽屉头部身份块：在 VisitorProfileIdentity 基础上带人物级转化状态。
 * 由 getVisitorActivity 返回；seed 占位仅满足 VisitorProfileIdentity 子集，故转化字段仅加载后可用。
 */
export interface VisitorIdentityBlock extends VisitorProfileIdentity {
  /** 识别时间（ISO）：已识别访客才有；旧响应/seed 占位可能无此字段 */
  identifiedAt?: string | null;
  /** 最近一条询盘 contactId：人物级转化去重锚点（无询盘为 null） */
  latestContactId: string | null;
  /** 该访客任一询盘已关联的 Customer id（已转标记；未转为 null） */
  convertedCustomerId: string | null;
}

type Params = Record<string, string | number | undefined>;

export function useAnalyticsOverview(params?: Params) {
  return useQuery<AnalyticsOverview>({
    queryKey: ['analytics', 'overview', params ?? {}],
    queryFn: () => api.query<AnalyticsOverview>('analytics/overview', params),
    placeholderData: (prev) => prev,
  });
}

export function useAnalyticsSources(params?: Params) {
  return useQuery<AnalyticsSources>({
    queryKey: ['analytics', 'sources', params ?? {}],
    queryFn: () => api.query<AnalyticsSources>('analytics/sources', params),
    placeholderData: (prev) => prev,
  });
}

export function useAnalyticsPages(params?: Params) {
  return useQuery<ListResult<AnalyticsPageRow>>({
    queryKey: ['analytics', 'pages', params ?? {}],
    queryFn: () => api.list<AnalyticsPageRow>('analytics/pages', params),
    placeholderData: (prev) => prev,
  });
}

export function useAnalyticsRegions(params?: Params) {
  return useQuery<ListResult<AnalyticsRegionRow>>({
    queryKey: ['analytics', 'regions', params ?? {}],
    queryFn: () => api.list<AnalyticsRegionRow>('analytics/regions', params),
    placeholderData: (prev) => prev,
  });
}

export function useAnalyticsReferrers(params?: Params) {
  return useQuery<ListResult<AnalyticsReferrerRow>>({
    queryKey: ['analytics', 'referrers', params ?? {}],
    queryFn: () => api.list<AnalyticsReferrerRow>('analytics/referrers', params),
    placeholderData: (prev) => prev,
  });
}

export function useAnalyticsIpTraffic(params?: Params) {
  return useQuery<ListResult<AnalyticsIpTrafficRow>>({
    queryKey: ['analytics', 'ip-traffic', params ?? {}],
    queryFn: () => api.list<AnalyticsIpTrafficRow>('analytics/ip-traffic', params),
    placeholderData: (prev) => prev,
  });
}

export function useAnalyticsVisitorDetails(params?: Params) {
  return useQuery<ListResult<AnalyticsVisitorDetailRow>>({
    queryKey: ['analytics', 'visitor-details', params ?? {}],
    queryFn: () => api.list<AnalyticsVisitorDetailRow>('analytics/visitor-details', params),
    placeholderData: (prev) => prev,
  });
}

export function useAnalyticsVisitors(params?: Params) {
  return useQuery<ListResult<AnalyticsVisitorRow>>({
    queryKey: ['analytics', 'visitors', params ?? {}],
    queryFn: () => api.list<AnalyticsVisitorRow>('analytics/visitors', params),
    placeholderData: (prev) => prev,
  });
}

/** 「按访客」全量导出取数（命令式，点击导出时调用；后端上限 5000 行） */
export function fetchVisitorsExport(params?: Params) {
  return api.list<AnalyticsVisitorExportRow>('analytics/visitors/export', params);
}

/** 「按 IP」全量导出取数（命令式，点击导出时调用；后端上限 5000 行） */
export function fetchVisitorDetailsExport(params?: Params) {
  return api.list<AnalyticsVisitorDetailRow>('analytics/visitor-details/export', params);
}

export function useAnalyticsVisitorActivity(visitorId: string | null, params?: Params) {
  return useQuery<AnalyticsVisitorActivity>({
    queryKey: ['analytics', 'visitor-activity', visitorId, params ?? {}],
    queryFn: () =>
      api.query<AnalyticsVisitorActivity>('analytics/visitor-activity', {
        visitorId: visitorId ?? '',
        ...params,
      }),
    enabled: !!visitorId,
    placeholderData: (prev) => prev,
  });
}

/** 按 IP（ipHash）拉取浏览行为时间线 + 关联访客，供 /analytics「访客明细」下钻（row.id 即 ipHash）。 */
export function useAnalyticsIpActivity(ipHash: string | null, params?: Params) {
  return useQuery<AnalyticsIpActivity>({
    queryKey: ['analytics', 'ip-activity', ipHash, params ?? {}],
    queryFn: () =>
      api.query<AnalyticsIpActivity>('analytics/ip-activity', {
        ipHash: ipHash ?? '',
        ...params,
      }),
    enabled: !!ipHash,
    placeholderData: (prev) => prev,
  });
}

/** 按 visitorId 归并的询盘列表，供人物抽屉「询盘」tab。 */
export function useVisitorInquiries(visitorId: string | null, params?: Params) {
  return useQuery<{ data: AnalyticsVisitorInquiry[] }>({
    queryKey: ['analytics', 'visitor-inquiries', visitorId, params ?? {}],
    queryFn: () =>
      api.query<{ data: AnalyticsVisitorInquiry[] }>('analytics/visitor-inquiries', {
        visitorId: visitorId ?? '',
        ...params,
      }),
    enabled: !!visitorId,
    placeholderData: (prev) => prev,
  });
}

export function formatLastSeen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const DEVICE_LABELS: Record<string, string> = {
  desktop: '桌面端',
  mobile: '移动端',
  tablet: '平板',
  unknown: '未知',
};

export function deviceLabel(v: string): string {
  return DEVICE_LABELS[v] ?? v;
}

/**
 * 设备型号展示：型号串未含厂商名时补注厂商，如「SM-S911B（Samsung）」。
 * 型号缺失返回 null；厂商缺失或已包含在型号中则仅返回型号。
 */
export function formatDeviceModel(model?: string | null, vendor?: string | null): string | null {
  if (!model) return null;
  if (vendor && !model.includes(vendor)) return `${model}（${vendor}）`;
  return model;
}

export const SOURCE_LABELS: Record<string, string> = {
  direct: '直接访问',
  organic: '自然搜索',
  paid: '付费广告',
  social: '社交媒体',
  email: '邮件',
  referral: '外部引荐',
  other: '其它',
};

export function sourceLabel(v: string): string {
  return SOURCE_LABELS[v] ?? v;
}

/**
 * 前端裸拼地区标签的统一口径（与后端 formatGeoLabel 语义对齐）：
 * 内网/本地 IP 入库哨兵值 country='LOCAL' 显示为「本地网络」，
 * 其余 region · city 优先、回退 country，全空时回退调用方给定的占位符。
 */
export function regionLabel(
  parts: { country?: string | null; region?: string | null; city?: string | null },
  fallback = '—',
): string {
  if (parts.country === 'LOCAL') return '本地网络';
  const local = [parts.region, parts.city].filter(Boolean).join(' · ');
  return local || parts.country || fallback;
}

export function formatShortDate(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

/**
 * 趋势图横轴桶标签：随粒度切换展示精度。
 * hour → 月/日 时:分；month → 年 月；day/week → 复用短日期（月/日）。
 */
export function formatBucketLabel(v: string, g: Granularity): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  if (g === 'hour') {
    return d.toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (g === 'month') {
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short' });
  }
  return formatShortDate(v);
}

// 访问时段（凌晨/上午/下午/晚上）
export function formatTimeOfDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  if (h < 6) return '凌晨';
  if (h < 12) return '上午';
  if (h < 18) return '下午';
  return '晚上';
}

// 会话时长（首末页时间差，非真实停留，标注「约」）
export function formatDuration(ms: number): string {
  if (!ms || ms < 0) return '—';
  const min = Math.round(ms / 60000);
  if (min < 1) return '约 1 分内';
  if (min < 60) return `约 ${min} 分`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `约 ${h} 时 ${m} 分` : `约 ${h} 时`;
}

export const DEFAULT_PAGE_SORT = { column: 'pageViews', order: 'desc' as const };
export const DEFAULT_REGION_SORT = { column: 'pageViews', order: 'desc' as const };
export const DEFAULT_REFERRER_SORT = { column: 'pageViews', order: 'desc' as const };
export const DEFAULT_VISITOR_DETAIL_SORT = { column: 'pageViews', order: 'desc' as const };
export const DEFAULT_VISITORS_SORT = { column: 'lastSeenAt', order: 'desc' as const };
