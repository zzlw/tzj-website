'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, cn } from '@tzj/ui';
import {
  Activity,
  ArrowUpRight,
  Clock,
  Globe,
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
import { sourceLabel } from '@/features/analytics';
import type { ContactItem } from '@/features/types';
import { getContactVisitorProfile } from '../api';
import type { ContactVisitorProfile } from '../types';
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
const GEO_SOURCE_LABEL: Record<ContactVisitorProfile['geoSource'], string> = {
  ip: 'IP 定位',
  geoip: '粗定位',
  unknown: '',
};

function deviceLabel(p: ContactVisitorProfile): string | null {
  const parts = [p.browser, p.os, p.deviceType].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/** 渠道来源：优先分析渠道分组（sourceLabel），回退 referrerHost / 直接访问。 */
function channelLabel(p: ContactVisitorProfile): string {
  if (p.trafficSource) return sourceLabel(p.trafficSource);
  return p.referrerHost || '直接访问';
}

/** 营销活动：utm_campaign（含 source/medium 补充）。 */
function campaignLabel(p: ContactVisitorProfile): string | null {
  if (!p.utmCampaign) return null;
  const extra = [p.utmSource, p.utmMedium].filter(Boolean).join(' / ');
  return extra ? `${p.utmCampaign}（${extra}）` : p.utmCampaign;
}

/** 站内行为：X 次浏览 · Y 次会话。 */
function behaviorLabel(p: ContactVisitorProfile): string | null {
  if (p.pageViews == null) return null;
  const pv = `${p.pageViews} 次浏览`;
  return p.sessions != null ? `${pv} · ${p.sessions} 次会话` : pv;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/** 地区行：IP 重解析地址（+ 运营商 hint + 定位依据徽标），回退 GeoIP 粗定位。 */
function geoRow(p: ContactVisitorProfile): InfoRow | null {
  if (!p.location) return null;
  return {
    key: 'geo',
    icon: MapPin,
    value: p.location,
    hint: p.isp ?? undefined,
    badge: GEO_SOURCE_LABEL[p.geoSource],
  };
}

/** 首末访问行：仅有最近访问时展示，与首次不同时呈现区间。 */
function seenRow(p: ContactVisitorProfile): InfoRow | null {
  const last = p.lastSeenAt ? formatDate(p.lastSeenAt) : '';
  if (!last) return null;
  const first = p.firstSeenAt ? formatDate(p.firstSeenAt) : '';
  const value = first && first !== last ? `${first} → ${last}` : last;
  return { key: 'seen', icon: Clock, value };
}

/** 组装信息行（纯函数，分支集中于此以收敛组件认知复杂度）。 */
function buildInfoRows(p?: ContactVisitorProfile): InfoRow[] {
  if (!p) return [];
  const device = deviceLabel(p);
  const campaign = campaignLabel(p);
  const behavior = behaviorLabel(p);
  const candidates: Array<InfoRow | null> = [
    geoRow(p),
    device ? { key: 'device', icon: Monitor, value: device } : null,
    { key: 'channel', icon: Globe, value: channelLabel(p) },
    campaign ? { key: 'campaign', icon: Megaphone, value: campaign } : null,
    p.landingPath
      ? { key: 'landing', icon: MousePointerClick, value: p.landingPath, truncate: true }
      : null,
    behavior ? { key: 'behavior', icon: Activity, value: behavior } : null,
    seenRow(p),
    p.ipMasked ? { key: 'ip', icon: Wifi, value: p.ipMasked, muted: true } : null,
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

/** 转化 CTA：已转化显示客户链接，否则显示按钮 + 弹窗。 */
function LeadAction({
  contact,
  profile,
  onConverted,
}: {
  contact: ContactItem;
  profile?: ContactVisitorProfile;
  onConverted: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (profile?.convertedCustomerId) {
    return (
      <Link
        href={`/customers/${profile.convertedCustomerId}`}
        className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-medium transition"
      >
        <ArrowUpRight className="h-3.5 w-3.5" />
        查看客户档案
      </Link>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-xs"
        onClick={() => setOpen(true)}
      >
        <UserRoundPlus className="mr-1.5 h-3.5 w-3.5" />
        转为客户线索
      </Button>
      <ConvertToLeadDialog
        contact={contact}
        profile={profile}
        open={open}
        onOpenChange={setOpen}
        onConverted={onConverted}
      />
    </>
  );
}

/**
 * 询盘访客画像面板：对齐「访客分析」——地区按原始 IP 读取时重解析（省市区 + 运营商），
 * 并展示站内行为与营销归因；附「转为客户线索」入口。
 */
export function ContactVisitorPanel({ contact }: { contact: ContactItem }) {
  const queryClient = useQueryClient();
  const { openPerson } = useVisitorDrawer();
  const { data: profile, isLoading } = useQuery({
    queryKey: ['contact', 'visitor-profile', contact.id],
    queryFn: () => getContactVisitorProfile(contact.id),
    staleTime: 60_000,
  });

  const rows = buildInfoRows(profile);
  const visitorId = profile?.visitorId ?? null;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs font-medium">访客信息</span>
        <LeadAction
          contact={contact}
          profile={profile}
          onConverted={() =>
            queryClient.invalidateQueries({ queryKey: ['contact', 'visitor-profile', contact.id] })
          }
        />
      </div>
      {rows.length > 0 ? (
        <dl className="space-y-1.5 text-xs">
          {rows.map((row) => (
            <InfoRowView key={row.key} row={row} />
          ))}
        </dl>
      ) : (
        <p className="text-muted-foreground text-xs">
          {isLoading ? '正在加载访客画像…' : '暂无访客画像（未采集到该询盘的浏览轨迹）'}
        </p>
      )}
      {visitorId ? (
        <div className="border-border/60 mt-2.5 border-t pt-2">
          <button
            type="button"
            onClick={() =>
              openPerson(visitorId, {
                name: contact.name,
                email: contact.email ?? null,
                phone: contact.phone ?? null,
                company: contact.company ?? null,
              })
            }
            className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-medium transition"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            查看完整访客档案
          </button>
        </div>
      ) : null}
    </div>
  );
}
