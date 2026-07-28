'use client';

import {
  Card,
  CardContent,
  DateRangePicker,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@tzj/ui';
import { Fingerprint, Network } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { IpVisitorLens } from '@/components/visitors/IpVisitorLens';
import { PeopleVisitorLens } from '@/components/visitors/PeopleVisitorLens';
import { stringField, useUrlState } from '@/lib/use-url-state';

const TAB_QUERY_KEY = 'tab';
type VisitorTab = 'people' | 'ip';

/**
 * 访客中心：单一逐访客下钻入口，两个聚合轴用 lens 切换（业内 GA4 + Leadfeeder 模式）。
 * ·「按访客」：按人聚合（身份/意向/线索/聊天）——获客视角。
 * ·「按 IP」：按 IP/网络聚合（地理/流量质量/反刷 + 关联访客桥）——流量视角。
 * 聚合报表看板见「访客分析」/analytics，本页只做逐访客明细，避免两页重复。
 */
export default function VisitorsPage() {
  const [dateState, setDate] = useUrlState({
    from: stringField(),
    to: stringField(),
  });
  const from = dateState.from;
  const to = dateState.to;

  const dateParams = useMemo(() => ({ from: from || undefined, to: to || undefined }), [from, to]);

  // Tab 状态经 URL 参数 ?tab=people|ip 持久化（刷新/分享可恢复）；
  // 切换时用 history.replaceState 仅更新地址栏、不触发 RSC 请求（复用侧边栏同款策略）。
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<VisitorTab>(() =>
    searchParams.get(TAB_QUERY_KEY) === 'ip' ? 'ip' : 'people',
  );

  const handleTabChange = useCallback((value: string) => {
    const next = value === 'ip' ? 'ip' : 'people';
    setTab(next);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (next === 'people') params.delete(TAB_QUERY_KEY);
      else params.set(TAB_QUERY_KEY, next);
      const qs = params.toString();
      window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
    }
  }, []);

  return (
    <>
      <PageHeader
        title="访客中心"
        description="逐访客明细与下钻：可「按访客」（身份/意向/聊天）或「按 IP」（网络/地理/关联访客）两个视角查看。聚合统计看板见「访客分析」。"
      />

      <Card className="mb-6 border-border/80 py-0">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <DateRangePicker
            className="h-9 w-[280px]"
            from={from}
            to={to}
            onChange={({ from: f, to: t }) => {
              setDate({ from: f, to: t });
            }}
          />
          <p className="text-xs text-muted-foreground">未选日期时默认展示近 7 天。</p>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="people" className="gap-1.5">
            <Fingerprint className="h-4 w-4" />
            按访客
          </TabsTrigger>
          <TabsTrigger value="ip" className="gap-1.5">
            <Network className="h-4 w-4" />按 IP
          </TabsTrigger>
        </TabsList>
        <TabsContent value="people">
          <PeopleVisitorLens dateParams={dateParams} />
        </TabsContent>
        <TabsContent value="ip">
          <IpVisitorLens dateParams={dateParams} />
        </TabsContent>
      </Tabs>
    </>
  );
}
