/**
 * 访问趋势图的时间粒度工具（与 apps/api analytics.service.ts 的阈值保持一致）。
 *
 * 设计（对齐 GA/Matomo 业内习惯）：
 * - 顶部日期范围与粒度正交：范围决定「看多久」，粒度决定「按什么聚合」。
 * - 粒度默认值随范围自动推导（defaultGranularity），用户可在图表卡片头显式覆盖。
 * - 跨度过大的过细粒度置灰（allowedGranularities），避免上千个数据点。
 * - 后端为权威：非法/缺省一律回落自动默认，并回传实际采用的粒度。
 */
export type Granularity = 'hour' | 'day' | 'week' | 'month';

export const GRANULARITIES: readonly Granularity[] = ['hour', 'day', 'week', 'month'];

export const GRANULARITY_LABELS: Record<Granularity, string> = {
  hour: '按小时',
  day: '按天',
  week: '按周',
  month: '按月',
};

/** 日期跨度（天，含首尾）；未选范围时按官网默认「近 7 天」。 */
export function spanDays(from?: string, to?: string): number {
  const now = Date.now();
  const t = to ? new Date(to).getTime() : now;
  const f = from ? new Date(from).getTime() : now - 6 * 86400000;
  if (Number.isNaN(f) || Number.isNaN(t) || t < f) return 7;
  return Math.max(1, Math.round((t - f) / 86400000) + 1);
}

/** 合法粒度集合：跨度越大，越细的粒度越先被剔除（点数上限约束）。 */
export function allowedGranularities(from?: string, to?: string): Granularity[] {
  const d = spanDays(from, to);
  const out: Granularity[] = [];
  if (d <= 7) out.push('hour');
  if (d <= 186) out.push('day');
  if (d <= 1100) out.push('week');
  out.push('month');
  return out;
}

/** 自动默认粒度：始终落在 allowedGranularities 内。 */
export function defaultGranularity(from?: string, to?: string): Granularity {
  const d = spanDays(from, to);
  if (d <= 2) return 'hour';
  if (d <= 92) return 'day';
  if (d <= 730) return 'week';
  return 'month';
}

/** 解析显式粒度：合法则采用，否则回落自动默认（供 UI 高亮与请求参数）。 */
export function resolveGranularity(explicit: string, from?: string, to?: string): Granularity {
  if (explicit && allowedGranularities(from, to).includes(explicit as Granularity)) {
    return explicit as Granularity;
  }
  return defaultGranularity(from, to);
}
