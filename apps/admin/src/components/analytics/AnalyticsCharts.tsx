'use client';

import { Skeleton } from '@tzj/ui';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnalyticsOverview } from '@/features/analytics';
import { formatBucketLabel } from '@/features/analytics';
import type { Granularity } from '@/lib/analytics-granularity';
import {
  CHART_COLORS,
  CHART_GRID,
  CHART_MUTED,
  CHART_PRIMARY,
  CHART_SECONDARY,
} from './chart-theme';

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-md">
      {label ? <p className="mb-1 font-medium text-foreground">{label}</p> : null}
      {payload.map((item) => (
        <p key={item.name} className="flex items-center gap-2 text-muted-foreground">
          <span
            className="inline-block size-2 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span>{item.name}</span>
          <span className="ml-auto tabular-nums font-medium text-foreground">
            {typeof item.value === 'number' ? item.value.toLocaleString('zh-CN') : item.value}
          </span>
        </p>
      ))}
    </div>
  );
}

function ChartSkeleton({ height = 280 }: { height?: number }) {
  return <Skeleton className="w-full rounded-md" style={{ height }} />;
}

export function TrendChart({
  daily,
  granularity,
  loading,
  height = 320,
}: {
  daily: AnalyticsOverview['daily'];
  granularity: Granularity;
  loading?: boolean;
  height?: number;
}) {
  if (loading) return <ChartSkeleton height={height} />;

  if (daily.length === 0) {
    return (
      <p
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        所选时段暂无访问数据
      </p>
    );
  }

  const data = daily.map((d) => ({
    ...d,
    label: formatBucketLabel(d.date, granularity),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="pvGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_PRIMARY} stopOpacity={0.25} />
            <stop offset="100%" stopColor={CHART_PRIMARY} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: CHART_MUTED, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: CHART_MUTED, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend
          verticalAlign="top"
          height={28}
          formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
        />
        <Area
          yAxisId="left"
          type="linear"
          dataKey="pageViews"
          name="PV"
          stroke={CHART_PRIMARY}
          strokeWidth={2}
          fill="url(#pvGradient)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Line
          yAxisId="left"
          type="linear"
          dataKey="uniqueVisitors"
          name="UV"
          stroke={CHART_SECONDARY}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  items,
  loading,
  emptyText = '暂无数据',
}: {
  // color 可选：语义型分布（如兼容性 支持/不支持/未知）传固定色，否则按品牌色轮转。
  items: Array<{ name: string; value: number; color?: string }>;
  loading?: boolean;
  emptyText?: string;
}) {
  if (loading) return <ChartSkeleton height={240} />;

  if (items.length === 0) {
    return (
      <p className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        {emptyText}
      </p>
    );
  }

  const total = items.reduce((s, i) => s + i.value, 0);

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
      <div className="mx-auto h-[220px] w-full max-w-[220px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={items}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={88}
              paddingAngle={2}
              strokeWidth={0}
            >
              {items.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={entry.color ?? CHART_COLORS[index % CHART_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {items.map((item, index) => (
          <li key={item.name} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.color ?? CHART_COLORS[index % CHART_COLORS.length] }}
            />
            <span className="truncate">{item.name}</span>
            <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
              {Math.round((item.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HorizontalBarChart({
  items,
  loading,
  emptyText = '暂无数据',
  valueKey = 'value',
}: {
  items: Array<{ name: string; value: number }>;
  loading?: boolean;
  emptyText?: string;
  valueKey?: string;
}) {
  if (loading) return <ChartSkeleton height={Math.max(240, items.length * 36 || 240)} />;

  if (items.length === 0) {
    return (
      <p className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        {emptyText}
      </p>
    );
  }

  const height = Math.max(240, items.length * 36 + 40);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={items} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: CHART_MUTED, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tick={{ fill: CHART_MUTED, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
        <Bar dataKey={valueKey} name="访问量" radius={[0, 2, 2, 0]} maxBarSize={24}>
          {items.map((entry, index) => (
            <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
