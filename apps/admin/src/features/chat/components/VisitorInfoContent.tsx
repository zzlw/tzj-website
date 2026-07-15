'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Monitor,
  Globe,
  MousePointerClick,
  Wifi,
  UserRoundPlus,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@tzj/ui';
import { ConvertToLeadDialog } from './ConvertToLeadDialog';
import type { ChatRoom } from '../types';

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

/** 访客信息列表（无外层卡片包装，供 Popover/侧栏等容器组合使用） */
export function VisitorInfoContent({ room }: { room: ChatRoom }) {
  const geo = geoLabel(room);
  const device = deviceLabel(room);
  const hasAny =
    geo || device || room.referrer || room.landingPath || room.ipMasked;

  if (!hasAny) {
    return (
      <p className="text-muted-foreground text-xs">
        暂无访客画像（该会话创建时未采集设备 / 来源 / IP 信息）
      </p>
    );
  }

  return (
    <dl className="space-y-1.5 text-xs">
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
