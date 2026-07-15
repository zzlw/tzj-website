'use client';

import { Button } from '@tzj/ui';
import {
  ArrowUpRight,
  Globe,
  MapPin,
  Monitor,
  MousePointerClick,
  UserRoundPlus,
  Wifi,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { ChatRoom } from '../types';
import { ConvertToLeadDialog } from './ConvertToLeadDialog';

function geoLabel(r: ChatRoom): string | null {
  const parts = [r.city, r.region, r.country].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function deviceLabel(r: ChatRoom): string | null {
  const parts = [r.browser, r.os, r.deviceType].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function sourceLabel(r: ChatRoom): string {
  if (r.source) return r.source;
  if (r.referrerHost) return r.referrerHost;
  return '直接访问';
}

/** 访客信息卡片（对齐 Intercom/Crisp：位置 · 设备 · 来源 · 落地页 · 脱敏 IP）。 */
export function VisitorInfoCard({
  room,
  onConverted,
}: {
  room: ChatRoom;
  onConverted?: (customerId: string) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const geo = geoLabel(room);
  const device = deviceLabel(room);
  const hasAny = geo || device || room.referrer || room.landingPath || room.ipMasked;

  if (!hasAny) {
    return (
      <div className="border-border/40 rounded-2xl border bg-muted/30 p-3 text-xs sm:p-4">
        <p className="text-muted-foreground mb-2 font-medium">访客信息</p>
        <p className="text-muted-foreground/70 mb-3">
          暂无访客画像（该会话创建时未采集设备 / 来源 / IP 信息）
        </p>
        <LeadAction
          room={room}
          dialogOpen={dialogOpen}
          onOpenDialog={() => setDialogOpen(true)}
          onOpenChange={setDialogOpen}
          onConverted={onConverted}
        />
      </div>
    );
  }

  return (
    <div className="border-border/40 rounded-2xl border bg-muted/30 p-3 text-xs sm:p-4">
      <p className="text-muted-foreground mb-2 font-medium">访客信息</p>
      <dl className="space-y-1.5">
        {geo && (
          <div className="flex items-center gap-2">
            <MapPin className="text-muted-foreground size-3.5 shrink-0" />
            <span className="text-foreground/90">{geo}</span>
          </div>
        )}
        {device && (
          <div className="flex items-center gap-2">
            <Monitor className="text-muted-foreground size-3.5 shrink-0" />
            <span className="text-foreground/90">{device}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Globe className="text-muted-foreground size-3.5 shrink-0" />
          <span className="text-foreground/90">{sourceLabel(room)}</span>
        </div>
        {room.landingPath && (
          <div className="flex items-center gap-2">
            <MousePointerClick className="text-muted-foreground size-3.5 shrink-0" />
            <span className="text-foreground/90 truncate">{room.landingPath}</span>
          </div>
        )}
        {room.ipMasked && (
          <div className="flex items-center gap-2">
            <Wifi className="text-muted-foreground size-3.5 shrink-0" />
            <span className="text-muted-foreground">{room.ipMasked}</span>
          </div>
        )}
      </dl>
      <div className="border-border/40 mt-3 border-t pt-3">
        <LeadAction
          room={room}
          dialogOpen={dialogOpen}
          onOpenDialog={() => setDialogOpen(true)}
          onOpenChange={setDialogOpen}
          onConverted={onConverted}
        />
      </div>
    </div>
  );
}

/* ───── 转化 CTA：未转化显示按钮 + 弹窗；已转化显示客户链接 ───── */
function LeadAction({
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
  // 已转化 → 查看客户档案
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
