'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  type DataTableColumn,
  DateRangePicker,
  PageHeader,
} from '@tzj/ui';
import { useMemo } from 'react';
import { HorizontalBarChart } from '@/components/analytics/AnalyticsCharts';
import { SOURCE_LABELS, sourceLabel } from '@/features/analytics';
import { type ChannelFunnelRow, useSourcesFunnel } from '@/features/growth';
import { stringField, useUrlState } from '@/lib/use-url-state';

/** DataTable 需要 id 字段：channel 在漏斗结果中唯一，直接充当行 id。 */
type FunnelTableRow = ChannelFunnelRow & { id: string };

/** 无数据渠道的占位行（API 只返回区间内有流量的渠道，表格补全至完整枚举）。 */
function emptyFunnelRow(channel: string): FunnelTableRow {
  return {
    id: channel,
    channel,
    funnel: { visitors: 0, engaged: 0, inquiries: 0, customers: 0 },
    conversionRates: { visitToEngage: 0, engageToInquiry: 0, inquiryToCustomer: 0, overall: 0 },
  };
}

const FUNNEL_COLUMNS: DataTableColumn<FunnelTableRow>[] = [
  {
    key: 'channel',
    header: '渠道',
    className: 'font-medium',
    cell: (r) => sourceLabel(r.channel),
  },
  {
    key: 'visitors',
    header: '访客',
    className: 'tabular-nums',
    cell: (r) => r.funnel.visitors.toLocaleString('zh-CN'),
  },
  {
    key: 'engaged',
    header: '深度浏览',
    className: 'tabular-nums',
    cell: (r) => (
      <span>
        {r.funnel.engaged.toLocaleString('zh-CN')}
        <span className="ml-1 text-xs text-muted-foreground">
          ({r.conversionRates.visitToEngage}%)
        </span>
      </span>
    ),
  },
  {
    key: 'inquiries',
    header: '询盘',
    className: 'tabular-nums',
    cell: (r) => (
      <span>
        {r.funnel.inquiries.toLocaleString('zh-CN')}
        <span className="ml-1 text-xs text-muted-foreground">
          ({r.conversionRates.engageToInquiry}%)
        </span>
      </span>
    ),
  },
  {
    key: 'customers',
    header: '客户',
    className: 'tabular-nums',
    cell: (r) => (
      <span>
        {r.funnel.customers.toLocaleString('zh-CN')}
        <span className="ml-1 text-xs text-muted-foreground">
          ({r.conversionRates.inquiryToCustomer}%)
        </span>
      </span>
    ),
  },
  {
    key: 'overall',
    header: '整体转化率',
    className: 'tabular-nums font-medium',
    cell: (r) => `${r.conversionRates.overall}%`,
  },
];

/** 渠道归因：各流量渠道的 访客→深度浏览→询盘→客户 四层漏斗（默认近 30 天）。 */
export default function GrowthChannelsPage() {
  const [dateState, setDate] = useUrlState({
    from: stringField(),
    to: stringField(),
  });
  const from = dateState.from;
  const to = dateState.to;

  const params = useMemo(() => ({ from: from || undefined, to: to || undefined }), [from, to]);

  const { data, isLoading, isFetching } = useSourcesFunnel(params);
  const loading = isLoading || isFetching;

  // 有数据渠道按 API 顺序（访客数降序）在前，零数据渠道按枚举顺序补 0 行在后；首次加载（data 未到达）不补行，交给 DataTable 的 loading 态
  const rows = useMemo<FunnelTableRow[]>(() => {
    if (!data) return [];
    const withData = data.map((r) => ({ ...r, id: r.channel }));
    const seen = new Set(withData.map((r) => r.channel));
    const padded = Object.keys(SOURCE_LABELS)
      .filter((c) => !seen.has(c))
      .map(emptyFunnelRow);
    return [...withData, ...padded];
  }, [data]);

  const chartItems = useMemo(
    () =>
      (data ?? []).map((r) => ({
        name: sourceLabel(r.channel),
        value: r.funnel.visitors,
      })),
    [data],
  );

  return (
    <>
      <PageHeader
        title="渠道归因"
        description="各流量渠道的四层转化漏斗：访客 → 深度浏览（PV≥2）→ 询盘 → 客户。"
      />

      <Card className="mb-6 border-border/80 py-0">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <DateRangePicker
            className="h-9 w-[280px]"
            from={from}
            to={to}
            onChange={({ from: f, to: t }) => setDate({ from: f, to: t })}
          />
          <p className="text-xs text-muted-foreground">
            未选日期时默认展示近 30 天。括号内为相邻层级间的转化率。
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6 border-border/80">
        <CardHeader>
          <CardTitle className="text-base">渠道访客分布</CardTitle>
        </CardHeader>
        <CardContent>
          <HorizontalBarChart items={chartItems} loading={loading} emptyText="暂无渠道数据" />
        </CardContent>
      </Card>

      <DataTable
        columns={FUNNEL_COLUMNS}
        rows={rows}
        loading={loading}
        emptyText="所选区间暂无渠道数据"
      />
    </>
  );
}
