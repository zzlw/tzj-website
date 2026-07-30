'use client';

import { Button, Card, CardContent, DateRangePicker, PageHeader } from '@tzj/ui';
import { Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Can } from '@/components/Can';
import { AdSpendManagerDialog } from '@/components/growth/AdSpendManagerDialog';
import { formatCny, formatPercent, MetricCard } from '@/components/growth/MetricCard';
import { useConversionMetrics } from '@/features/growth';
import { stringField, useUrlState } from '@/lib/use-url-state';

/** 分平台花费小字的中文平台名（admin 自定义 UI 常量，不导入 @tzj/types 值常量） */
const PLATFORM_LABELS: Record<string, string> = {
  baidu: '百度',
  google: 'Google',
  wechat: '微信',
  other: '其他',
};

/** 转化看板：访客→客户核心转化指标 + 付费渠道归因（Phase1-MVP，默认近 7 天）。 */
export default function GrowthConversionsPage() {
  const [dateState, setDate] = useUrlState({
    from: stringField(),
    to: stringField(),
  });
  const from = dateState.from;
  const to = dateState.to;

  const params = useMemo(() => ({ from: from || undefined, to: to || undefined }), [from, to]);

  const { data, isLoading, isFetching } = useConversionMetrics(params);
  const loading = isLoading || isFetching;
  const [adSpendOpen, setAdSpendOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="转化看板"
        description="官网访客到客户的转化链路核心指标：整体转化率、付费渠道归因与询盘成本。"
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
            未选日期时默认展示近 7 天。历史区间数据按 T+1 预计算（每日凌晨更新）。
          </p>
        </CardContent>
      </Card>

      {/* 整体转化 */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="总访客数"
          value={data?.totalVisitors ?? 0}
          hint="去重独立访客（排除爬虫）"
          loading={loading}
        />
        <MetricCard
          label="转化客户数"
          value={data?.convertedCustomers ?? 0}
          hint="带访客归因的新建客户"
          loading={loading}
        />
        <MetricCard
          label="整体转化率"
          value={formatPercent(data?.conversionRate)}
          hint="转化客户 ÷ 总访客"
          loading={loading}
        />
        <MetricCard
          label="询盘成本"
          value={formatCny(data?.inquiryCost)}
          hint="区间内录入花费 ÷ 广告询盘（台账按天分摊）"
          loading={loading}
        />
      </div>

      {/* 付费渠道归因 */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">付费渠道（广告归因）</h2>
        <Can perm="settings.manage">
          <Button variant="outline" size="sm" onClick={() => setAdSpendOpen(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            管理广告花费
          </Button>
        </Can>
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="广告访客"
          value={data?.adVisitors ?? 0}
          hint="trafficSource = paid 的去重访客"
          loading={loading}
        />
        <MetricCard
          label="广告询盘"
          value={data?.adInquiries ?? 0}
          hint="广告访客提交的询盘数"
          loading={loading}
        />
        <MetricCard
          label="广告转化客户"
          value={data?.adCustomers ?? 0}
          hint="广告访客转化的客户数"
          loading={loading}
        />
        <MetricCard
          label="广告转化率"
          value={formatPercent(data?.adConversionRate)}
          hint={`区间广告花费：${formatCny(data?.adSpend)}（台账分摊）`}
          loading={loading}
        />
      </div>

      {/* 分平台花费小字：有台账数据时展示 */}
      {data?.adSpendByPlatform?.length ? (
        <p className="-mt-3 mb-6 text-xs text-muted-foreground">
          分平台花费：
          {data.adSpendByPlatform
            .map((p) => `${PLATFORM_LABELS[p.platform] ?? p.platform} ${formatCny(p.spend)}`)
            .join(' · ')}
        </p>
      ) : null}

      {data?.metricsDate ? (
        <p className="text-xs text-muted-foreground">
          数据计算时间：{new Date(data.metricsDate).toLocaleString('zh-CN')}
        </p>
      ) : null}

      <AdSpendManagerDialog open={adSpendOpen} onOpenChange={setAdSpendOpen} />
    </>
  );
}
