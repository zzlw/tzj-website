'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from '@tzj/ui';
import { ArrowRight, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { DonutChart, HorizontalBarChart, TrendChart } from '@/components/analytics/AnalyticsCharts';
import { deviceLabel, useAnalyticsOverview } from '@/features/analytics';

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

export function DashboardAnalyticsPanel() {
  const { data, isLoading } = useAnalyticsOverview();
  const loading = isLoading && !data;

  const deviceChartData = (data?.devices ?? []).map((d) => ({
    name: deviceLabel(d.deviceType),
    value: d.count,
  }));

  const pageChartData = (data?.topPages ?? []).slice(0, 6).map((p) => ({
    name: p.path.length > 24 ? `${p.path.slice(0, 22)}…` : p.path,
    value: p.pageViews,
  }));

  return (
    <Card className="mb-8 border-border/80 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            官网访客
          </CardTitle>
          <CardDescription>近 7 天访问趋势与热门页面（数据来自官网 C 端埋点）</CardDescription>
        </div>
        <Link
          href="/analytics"
          className="inline-flex shrink-0 items-center gap-1 text-sm text-primary hover:underline"
        >
          详细分析
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
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
            <TrendChart daily={data?.daily ?? []} loading={loading} height={240} />
          </div>
          <div className="space-y-6 xl:col-span-2">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">热门页面</p>
              <HorizontalBarChart
                items={pageChartData}
                loading={loading}
                emptyText="暂无页面数据"
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">设备分布</p>
              <DonutChart items={deviceChartData} loading={loading} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
