'use client';

import {
  Card,
  CardContent,
  DataTable,
  type DataTableColumn,
  DateRangePicker,
  PageHeader,
} from '@tzj/ui';
import { useMemo } from 'react';
import { formatMinutes, formatPercent, MetricCard } from '@/components/growth/MetricCard';
import { type SupportMetrics, useSupportMetrics } from '@/features/growth';
import { stringField, useUrlState } from '@/lib/use-url-state';

/** DataTable 需要 id 字段：maskedId 在排行内唯一（同名坐席后端已按邮箱聚合）。 */
type AgentRow = SupportMetrics['agentRankings'][number] & { id: string };

const AGENT_COLUMNS: DataTableColumn<AgentRow>[] = [
  {
    key: 'maskedId',
    header: '坐席',
    className: 'font-mono',
    cell: (r) => r.maskedId,
  },
  {
    key: 'totalRooms',
    header: '接待会话',
    className: 'tabular-nums',
    cell: (r) => r.totalRooms.toLocaleString('zh-CN'),
  },
  {
    key: 'avgFirstResponseTime',
    header: '平均首响',
    className: 'tabular-nums',
    cell: (r) => formatMinutes(r.avgFirstResponseTime),
  },
  {
    key: 'conversionRate',
    header: '会话转化率',
    className: 'tabular-nums font-medium',
    cell: (r) => `${r.conversionRate}%`,
  },
];

/** 客服绩效：团队会话概览 + 坐席排行（脱敏展示，默认近 7 天）。 */
export default function GrowthSupportPage() {
  const [dateState, setDate] = useUrlState({
    from: stringField(),
    to: stringField(),
  });
  const from = dateState.from;
  const to = dateState.to;

  const params = useMemo(() => ({ from: from || undefined, to: to || undefined }), [from, to]);

  const { data, isLoading, isFetching } = useSupportMetrics(params);
  const loading = isLoading || isFetching;
  const overview = data?.teamOverview;

  const agentRows = useMemo<AgentRow[]>(
    () => (data?.agentRankings ?? []).map((r) => ({ ...r, id: r.maskedId })),
    [data],
  );

  return (
    <>
      <PageHeader
        title="客服绩效"
        description="在线客服会话的团队概览与坐席排行：首响时长、会话转化率（坐席身份脱敏展示）。"
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
            未选日期时默认展示近 7 天。首响统计仅含已有坐席回复的会话。
          </p>
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="会话总数"
          value={overview?.totalRooms ?? 0}
          hint="区间内新建的客服会话"
          loading={loading}
        />
        <MetricCard
          label="转化会话"
          value={overview?.convertedRooms ?? 0}
          hint="已关联客户的会话"
          loading={loading}
        />
        <MetricCard
          label="会话转化率"
          value={formatPercent(overview?.supportConversionRate)}
          hint="转化会话 ÷ 会话总数"
          loading={loading}
        />
        <MetricCard
          label="平均首响时长"
          value={formatMinutes(overview?.avgFirstResponseTime)}
          hint="首条坐席回复距会话创建的均值"
          loading={loading}
        />
      </div>

      <h2 className="mb-3 text-sm font-medium text-muted-foreground">坐席排行（按接待量前 10）</h2>
      <DataTable
        columns={AGENT_COLUMNS}
        rows={agentRows}
        loading={loading}
        emptyText="所选区间暂无坐席接待记录"
      />
    </>
  );
}
