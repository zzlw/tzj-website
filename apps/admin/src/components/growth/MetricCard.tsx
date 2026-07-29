'use client';

import { Card, CardDescription, CardHeader, CardTitle, Skeleton } from '@tzj/ui';

/**
 * 增长看板指标卡：与访客分析页 StatCard 同风格，
 * 支持字符串值（百分比/金额等格式化后的展示）。
 */
export function MetricCard({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value: string | number;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">
          {loading ? (
            <Skeleton className="h-9 w-20" />
          ) : typeof value === 'number' ? (
            value.toLocaleString('zh-CN')
          ) : (
            value
          )}
        </CardTitle>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardHeader>
    </Card>
  );
}

/** 百分比展示：后端已四舍五入到两位小数，直接拼接 %。 */
export function formatPercent(v: number | undefined): string {
  return v === undefined ? '—' : `${v}%`;
}

/** 金额展示（元）：千分位 + 保留后端精度。 */
export function formatCny(v: number | undefined): string {
  return v === undefined ? '—' : `¥${v.toLocaleString('zh-CN')}`;
}

/** 分钟时长展示：≥60 分钟折算为 小时+分钟。 */
export function formatMinutes(v: number | undefined): string {
  if (v === undefined) return '—';
  if (v < 60) return `${v} 分钟`;
  const hours = Math.floor(v / 60);
  const minutes = Math.round(v % 60);
  return minutes > 0 ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`;
}
