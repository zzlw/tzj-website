'use client';

import { useQuery } from '@tanstack/react-query';
import { Button, cn, Popover, PopoverContent, PopoverTrigger } from '@tzj/ui';
import {
  Activity,
  ArrowUpRight,
  Clock,
  Globe,
  History,
  Info,
  type LucideIcon,
  MapPin,
  Megaphone,
  Monitor,
  MousePointerClick,
  UserRoundPlus,
  Wifi,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useVisitorDrawer } from '@/components/visitor-drawer/context';
import { formatDeviceModel, sourceLabel } from '@/features/analytics';
import { getChatVisitorProfile } from '../api';
import type { ChatRoom, ChatVisitorProfile } from '../types';
import { ConvertToLeadDialog } from './ConvertToLeadDialog';

/** 单条信息行的数据模型（纯数据，渲染交给 InfoRowView）。 */
interface InfoRow {
  key: string;
  icon: LucideIcon;
  value: string;
  /** 追加的次要说明（如运营商），灰字拼在主值后 */
  hint?: string;
  /** 小徽标（如定位依据 IP/粗定位） */
  badge?: string;
  /** 整行灰字（如脱敏 IP） */
  muted?: boolean;
  /** 过长时截断（如落地页路径） */
  truncate?: boolean;
}

/** 定位依据徽标文案 */
const GEO_SOURCE_LABEL: Record<ChatVisitorProfile['geoSource'], string> = {
  ip: 'IP 定位',
  geoip: '粗定位',
  unknown: '',
};

function geoLabel(r: ChatRoom): string | null {
  const parts = [r.city, r.region, r.country].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function deviceLabel(r: ChatRoom, p?: ChatVisitorProfile): string | null {
  const browser = [p?.browser ?? r.browser, p?.browserVersion].filter(Boolean).join(' ');
  const os = [p?.os ?? r.os, p?.osVersion].filter(Boolean).join(' ');
  // 型号带厂商（型号串未含厂商名时补注），如「SM-S911B（Samsung）」
  const model = formatDeviceModel(p?.deviceModel, p?.deviceVendor);
  const parts = [browser, os, p?.deviceType ?? r.deviceType, model].filter(Boolean);
  const base = parts.length ? parts.join(' · ') : null;
  const app = p?.clientApp;
  if (!base) return app ? `${app} 内嵌浏览器` : null;
  return app ? `${base}（${app} 内嵌）` : base;
}

/** 渠道来源：优先分析渠道分组（sourceLabel），回退 source/referrerHost/直接访问。 */
function channelLabel(r: ChatRoom, p?: ChatVisitorProfile): string {
  if (p?.trafficSource) return sourceLabel(p.trafficSource);
  if (r.source) return r.source;
  const host = p?.referrerHost ?? r.referrerHost;
  return host || '直接访问';
}

/** 营销活动：utm_campaign（含 source/medium 补充）。 */
function campaignLabel(p?: ChatVisitorProfile): string | null {
  if (!p?.utmCampaign) return null;
  const extra = [p.utmSource, p.utmMedium].filter(Boolean).join(' / ');
  return extra ? `${p.utmCampaign}（${extra}）` : p.utmCampaign;
}

/** 站内行为：X 次浏览 · Y 次会话。 */
function behaviorLabel(p?: ChatVisitorProfile): string | null {
  if (!p || p.pageViews == null) return null;
  const pv = `${p.pageViews} 次浏览`;
  return p.sessions != null ? `${pv} · ${p.sessions} 次会话` : pv;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/** 地区行：IP 重解析地址（+ 运营商 hint + 定位依据徽标），回退 GeoIP 粗定位。 */
function geoRow(room: ChatRoom, p?: ChatVisitorProfile): InfoRow | null {
  const value = p?.location ?? geoLabel(room);
  if (!value) return null;
  return {
    key: 'geo',
    icon: MapPin,
    value,
    hint: p?.isp ?? undefined,
    badge: p ? GEO_SOURCE_LABEL[p.geoSource] : undefined,
  };
}

/** 首末访问行：仅有最近访问时展示，与首次不同时呈现区间。 */
function seenRow(p?: ChatVisitorProfile): InfoRow | null {
  const last = p?.lastSeenAt ? formatDate(p.lastSeenAt) : '';
  if (!last) return null;
  const first = p?.firstSeenAt ? formatDate(p.firstSeenAt) : '';
  const value = first && first !== last ? `${first} → ${last}` : last;
  return { key: 'seen', icon: Clock, value };
}

/** 历史会话行：>0 时展示。 */
function historyRow(p?: ChatVisitorProfile): InfoRow | null {
  const n = p?.chatRoomCount ?? 0;
  return n > 0 ? { key: 'history', icon: History, value: `${n} 个历史会话` } : null;
}

/** 组装信息行（纯函数，分支集中于此以收敛组件认知复杂度）。 */
function buildInfoRows(room: ChatRoom, p?: ChatVisitorProfile): InfoRow[] {
  const device = deviceLabel(room, p);
  const landing = p?.landingPath ?? room.landingPath ?? null;
  const ip = p?.ipMasked ?? room.ipMasked ?? null;
  const campaign = campaignLabel(p);
  const behavior = behaviorLabel(p);
  const candidates: Array<InfoRow | null> = [
    geoRow(room, p),
    device ? { key: 'device', icon: Monitor, value: device } : null,
    { key: 'channel', icon: Globe, value: channelLabel(room, p) },
    campaign ? { key: 'campaign', icon: Megaphone, value: campaign } : null,
    landing ? { key: 'landing', icon: MousePointerClick, value: landing, truncate: true } : null,
    behavior ? { key: 'behavior', icon: Activity, value: behavior } : null,
    seenRow(p),
    historyRow(p),
    ip ? { key: 'ip', icon: Wifi, value: ip, muted: true } : null,
  ];
  return candidates.filter((r): r is InfoRow => r !== null);
}

/** 单行渲染：图标 + 主值（+ 可选次要说明/徽标/截断/灰字）。 */
function InfoRowView({ row }: { row: InfoRow }) {
  const Icon = row.icon;
  return (
    <div className="flex items-start gap-2">
      <Icon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
      <span
        className={cn(
          'min-w-0',
          row.muted ? 'text-muted-foreground' : 'text-foreground/90',
          row.truncate && 'truncate',
        )}
      >
        {row.value}
        {row.hint ? <span className="text-muted-foreground"> · {row.hint}</span> : null}
        {row.badge ? (
          <span className="bg-muted text-muted-foreground/80 ml-1 rounded px-1 py-0.5 text-[0.6rem]">
            {row.badge}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/** 访客信息列表（无外层卡片包装，供 Popover/侧栏等容器组合使用）。
    对齐「访客分析」：地区按原始 IP 读取时重解析（省市区 + 运营商），并展示站内行为与营销归因。 */
export function VisitorInfoContent({ room }: { room: ChatRoom }) {
  const { openPerson } = useVisitorDrawer();
  const { data: profile, isLoading } = useQuery({
    queryKey: ['chat', 'visitor-profile', room.roomId],
    queryFn: () => getChatVisitorProfile(room.roomId),
    staleTime: 60_000,
  });

  const rows = buildInfoRows(room, profile);
  const visitorId = profile?.visitorId ?? null;
  if (rows.length === 0 && !visitorId) {
    return (
      <p className="text-muted-foreground text-xs">
        {isLoading
          ? '正在加载访客画像…'
          : '暂无访客画像（该会话创建时未采集设备 / 来源 / IP 信息）'}
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {rows.length > 0 ? (
        <dl className="space-y-1.5 text-xs">
          {rows.map((row) => (
            <InfoRowView key={row.key} row={row} />
          ))}
        </dl>
      ) : null}
      {visitorId ? (
        <button
          type="button"
          onClick={() =>
            openPerson(visitorId, {
              name: room.clientName ?? null,
              email: room.clientEmail ?? null,
            })
          }
          className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-medium transition"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
          查看完整访客档案
        </button>
      ) : null}
    </div>
  );
}

/* ───── 转化 CTA：未转化显示按钮 + 弹窗；已转化显示客户链接 ───── */
export function LeadAction({
  room,
  dialogOpen,
  onOpenDialog,
  onOpenChange,
  onConverted,
}: {
  room: ChatRoom;
  dialogOpen: boolean;
  onOpenDialog: () => void;
  onOpenChange: (open: boolean) => void;
  onConverted?: (customerId: string) => void;
}) {
  if (room.customerId) {
    return (
      <>
        <Link
          href={`/customers/${room.customerId}`}
          className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-medium transition"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
          查看客户档案
        </Link>
        <ConvertToLeadDialog
          room={room}
          open={dialogOpen}
          onOpenChange={onOpenChange}
          onConverted={onConverted ?? (() => {})}
        />
      </>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full text-xs"
        onClick={onOpenDialog}
      >
        <UserRoundPlus className="mr-1.5 h-3.5 w-3.5" />
        转为客户线索
      </Button>
      <ConvertToLeadDialog
        room={room}
        open={dialogOpen}
        onOpenChange={onOpenChange}
        onConverted={onConverted ?? (() => {})}
      />
    </>
  );
}

const INFO_BUTTON_CLASS =
  'border-border/40 bg-background/60 text-muted-foreground hover:bg-muted/60 focus-visible:ring-primary/40 focus-visible:ring-offset-background size-8 rounded-full border transition focus-visible:ring-2 focus-visible:ring-offset-2 sm:size-10';

/**
 * 头部「访客信息」入口：有 visitorId 时一键直达公共访客抽屉（Intercom 全局实体抽屉模式，
 * 与访客中心/询盘等入口共用同一抽屉）；存量会话未采集 visitorId 时回退内嵌 Popover 画像。
 */
export function VisitorInfoButton({
  room,
  onConverted,
}: {
  room: ChatRoom;
  onConverted?: (customerId: string) => void;
}) {
  const { openPerson } = useVisitorDrawer();
  const { data: profile } = useQuery({
    queryKey: ['chat', 'visitor-profile', room.roomId],
    queryFn: () => getChatVisitorProfile(room.roomId),
    staleTime: 60_000,
  });
  const visitorId = profile?.visitorId ?? null;
  const [infoOpen, setInfoOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  // 有 visitorId：直接拉起公共访客抽屉（含完整画像 + 转化 CTA）
  if (visitorId) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="访客信息"
        onClick={() =>
          openPerson(visitorId, {
            name: room.clientName ?? null,
            email: room.clientEmail ?? null,
          })
        }
        className={INFO_BUTTON_CLASS}
      >
        <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </Button>
    );
  }

  // 无 visitorId（存量会话未采集）：回退内嵌 Popover 画像
  return (
    <Popover open={infoOpen} onOpenChange={setInfoOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="访客信息"
          className={INFO_BUTTON_CLASS}
        >
          <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        className="w-80 p-3"
        onInteractOutside={(e) => {
          // 阻止点外部时关闭，导致内嵌 ConvertToLeadDialog 关闭
          const target = e.target as HTMLElement | null;
          if (target?.closest('[data-radix-popper-content-wrapper]')) return;
        }}
      >
        <div className="space-y-3">
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-medium">访客信息</p>
            <VisitorInfoContent room={room} />
          </div>
          <div className="border-border/40 border-t pt-2">
            <LeadAction
              room={room}
              dialogOpen={convertOpen}
              onOpenDialog={() => setConvertOpen(true)}
              onOpenChange={setConvertOpen}
              onConverted={(cid) => {
                setConvertOpen(false);
                setInfoOpen(false);
                onConverted?.(cid);
              }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
