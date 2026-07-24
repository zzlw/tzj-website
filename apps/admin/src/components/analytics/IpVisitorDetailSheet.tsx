'use client';

/**
 * IP 访客明细抽屉（/analytics「访客明细」下钻）：
 * 按 IP（ipHash）展示该 IP 的浏览行为时间线，并列出「关联访客」芯片。
 * IP↔访客为多对多（NAT/共享网络下一个 IP 可能对应多人），故不将 IP 坍缩为单个身份，
 * 而是提供芯片桥：点击后经全局 Provider 按 visitorId 压栈打开完整人物抽屉（VisitorProfileSheet），
 * 与业内（GA4/Segment）以匿名 ID 为身份主线、IP 仅作地理/安全维度的实践一致。
 * ID 驱动：仅凭 ipHash 取数即可渲染，seed 仅用于加载前的标题占位。
 */
import { Badge, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@tzj/ui';
import { Users } from 'lucide-react';
import { useVisitorDrawer } from '@/components/visitor-drawer/context';
import {
  type AnalyticsRelatedVisitor,
  type IpDrawerSeed,
  useAnalyticsIpActivity,
} from '@/features/analytics';
import { VisitorActivityTimeline } from './VisitorActivityTimeline';

interface Props {
  ipHash: string | null;
  /** 加载前的标题占位（ip/地区/ISP/定位依据）；加载完成后由 activity.header 覆盖 */
  seed?: Partial<IpDrawerSeed>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  params?: { from?: string; to?: string };
}

function relatedVisitorName(v: AnalyticsRelatedVisitor): string {
  return v.name || v.email || v.phone || '匿名访客';
}

/** 关联访客芯片区：该 IP 下去重访客，点击经全局 Provider 压栈打开人物抽屉 */
function RelatedVisitorsBar({ visitors }: { visitors: AnalyticsRelatedVisitor[] }) {
  const { openPerson } = useVisitorDrawer();
  return (
    <div className="border-b px-5 py-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        关联访客（{visitors.length}）· 同一 IP 可能对应多人，点击按访客身份下钻
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visitors.map((v) => (
          <button
            key={v.visitorId}
            type="button"
            onClick={() => openPerson(v.visitorId, v)}
            className="hover:bg-muted flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors"
          >
            <span className="max-w-[160px] truncate font-medium">{relatedVisitorName(v)}</span>
            {v.identified ? (
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 px-1 py-0 text-[0.6rem] text-emerald-700"
              >
                已识别
              </Badge>
            ) : null}
            <span className="text-muted-foreground tabular-nums">{v.pageViews} 页</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function IpVisitorDetailSheet({ ipHash, seed, open, onOpenChange, params }: Props) {
  const { data, isLoading } = useAnalyticsIpActivity(open ? ipHash : null, params);
  // 头部优先用后端 header（仅凭 ipHash 即可渲染），回退到打开前透传的 seed。
  const header = data?.header;
  const ip = header?.ip ?? seed?.ip ?? null;
  const ipMasked = header?.ipMasked ?? seed?.ipMasked ?? null;
  const region = header?.region ?? seed?.region ?? null;
  const isp = header?.isp ?? seed?.isp ?? null;
  const geoSource = header?.geoSource ?? seed?.geoSource ?? null;
  const ipLabel = ip || ipMasked || '未知 IP';
  const geoLabel = [region, isp].filter(Boolean).join(' · ') || '地区未知';
  const relatedVisitors = data?.relatedVisitors ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[520px] max-w-[90vw] flex-col p-0 sm:max-w-[520px]"
      >
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="font-mono text-base">{ipLabel}</SheetTitle>
          <SheetDescription>
            {geoLabel} · 定位依据 {geoSource ?? '—'}
          </SheetDescription>
        </SheetHeader>

        {relatedVisitors.length > 0 ? <RelatedVisitorsBar visitors={relatedVisitors} /> : null}

        <VisitorActivityTimeline data={data} isLoading={isLoading} />
      </SheetContent>
    </Sheet>
  );
}
