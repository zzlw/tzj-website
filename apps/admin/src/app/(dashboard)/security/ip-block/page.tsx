'use client';

import { Card, CardContent, DateRangePicker, PageHeader } from '@tzj/ui';
import { IpBlockPanel } from '@/components/security/IpBlockPanel';
import { stringField, useUrlState } from '@/lib/use-url-state';

export default function SecurityIpBlockPage() {
  const [dateState, setDate] = useUrlState({ from: stringField(), to: stringField() });
  const from = dateState.from || undefined;
  const to = dateState.to || undefined;

  return (
    <>
      <PageHeader
        title="IP 封禁"
        description="管理官网访问黑名单。封禁后该 IP 的页面浏览将不再写入统计（静默丢弃）。IP 以哈希存储，列表仅显示脱敏地址。"
      />

      <Card className="mb-6 border-border/80 py-0 shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <DateRangePicker
            className="h-9 w-[280px]"
            from={from}
            to={to}
            onChange={({ from: f, to: t }) => {
              setDate({ from: f ?? '', to: t ?? '' });
            }}
          />
          <p className="text-xs text-muted-foreground">
            未选日期时默认近 7 天，用于下方「高频 IP」排行。
          </p>
        </CardContent>
      </Card>

      <IpBlockPanel from={from} to={to} />
    </>
  );
}
