'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from '@tzj/ui';
import { ArrowRight, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { DonutChart, HorizontalBarChart, TrendChart } from '@/components/analytics/AnalyticsCharts';
import {
  deviceLabel,
  sourceLabel,
  useAnalyticsOverview,
  useAnalyticsSources,
} from '@/features/analytics';

function MiniStat({ label, value, loading }: { label: string; value: number; loading?: boolean }) {
  return (
    <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div
        className="mt-0.5 min-h-7 text-xl font-semibold tabular-nums tracking-tight"
        aria-busy={loading}
      >
        {loading ? <Skeleton className="h-7 w-16" /> : value.toLocaleString('zh-CN')}
      </div>
    </div>
  );
}

/** 图表分块小标题：统一各图上方的说明文字排版，避免重复内联样式。 */
function ChartBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

export function DashboardAnalyticsPanel() {
  const { data, isLoading } = useAnalyticsOverview();
  // 来源渠道单独取数（analytics/sources）：与概览正交，独立 loading 不阻塞主图。
  const sourcesQuery = useAnalyticsSources();
  const loading = isLoading && !data;
  const sourcesLoading = sourcesQuery.isLoading && !sourcesQuery.data;

  const deviceChartData = (data?.devices ?? []).map((d) => ({
    name: deviceLabel(d.deviceType),
    value: d.count,
  }));

  const pageChartData = (data?.topPages ?? []).slice(0, 6).map((p) => ({
    name: p.path.length > 24 ? `${p.path.slice(0, 22)}…` : p.path,
    value: p.pageViews,
  }));

  const regionChartData = (data?.topRegions ?? []).slice(0, 6).map((r) => ({
    name: r.region,
    value: r.pageViews,
  }));

  const channelChartData = (sourcesQuery.data?.channels ?? []).map((c) => ({
    name: sourceLabel(c.source),
    value: c.pageViews,
  }));

  return (
    <Card className="mb-8 border-border/80 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            官网访客
          </CardTitle>
          <CardDescription>
            近 7 天访问趋势、热门页面与来源分布（数据来自官网 C 端埋点）
          </CardDescription>
        </div>
        <Link
          href="/analytics"
          className="inline-flex shrink-0 items-center gap-1 text-sm text-primary hover:underline"
        >
          详细分析
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="今日 PV" value={data?.summary.pageViewsToday ?? 0} loading={loading} />
          <MiniStat
            label="今日 UV"
            value={data?.summary.uniqueVisitorsToday ?? 0}
            loading={loading}
          />
          <MiniStat label="7 日 PV" value={data?.summary.pageViews ?? 0} loading={loading} />
          <MiniStat label="7 日 UV" value={data?.summary.uniqueVisitors ?? 0} loading={loading} />
        </div>

        <div className="grid gap-6 xl:grid-cols-5">
          <div className="xl:col-span-3">
            <ChartBlock title="访问趋势（PV 面积 / UV 折线）">
              <TrendChart
                daily={data?.daily ?? []}
                granularity={data?.granularity ?? 'day'}
                loading={loading}
                height={248}
              />
            </ChartBlock>
          </div>
          <div className="xl:col-span-2">
            <ChartBlock title="热门页面">
              <HorizontalBarChart
                items={pageChartData}
                loading={loading}
                emptyText="暂无页面数据"
              />
            </ChartBlock>
          </div>
        </div>

        <div className="grid gap-6 border-t border-border/60 pt-6 md:grid-cols-3">
          <ChartBlock title="访客地区">
            <HorizontalBarChart
              items={regionChartData}
              loading={loading}
              emptyText="暂无地区数据"
            />
          </ChartBlock>
          <ChartBlock title="来源渠道">
            <DonutChart
              items={channelChartData}
              loading={sourcesLoading}
              emptyText="暂无来源数据"
            />
          </ChartBlock>
          <ChartBlock title="设备分布">
            <DonutChart items={deviceChartData} loading={loading} />
          </ChartBlock>
        </div>
      </CardContent>
    </Card>
  );
}
