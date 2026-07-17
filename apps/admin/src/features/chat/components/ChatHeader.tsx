'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, Button, Popover, PopoverContent, PopoverTrigger, cn } from '@tzj/ui';
import { ArrowLeftRight, Info, MoreVertical, Phone, Video, XCircle } from 'lucide-react';
import type { ChatRoom, ChatRoomStatusKey, PresenceStatus } from '../types';
import type { OnlineAgent } from '../useChatSocket';
import { LeadAction, VisitorInfoContent } from './VisitorInfoContent';

const statusMeta: Record<ChatRoomStatusKey, { label: string; dot: string }> = {
  waiting: { label: '等待中', dot: 'bg-sky-500' },
  active: { label: '进行中', dot: 'bg-emerald-500' },
  closed: { label: '已关闭', dot: 'bg-zinc-400' },
  archived: { label: '已归档', dot: 'bg-zinc-300' },
};

const presenceMeta: Record<PresenceStatus, { label: string; dot: string }> = {
  online: { label: '在线', dot: 'bg-emerald-500' },
  away: { label: '离开', dot: 'bg-amber-500' },
  offline: { label: '离线', dot: 'bg-zinc-400' },
};

function initials(name?: string, email?: string) {
  const base = (name ?? email ?? '?').trim();
  return base.slice(0, 1).toUpperCase() || '?';
}

export function ChatHeader({
  room,
  onClose,
  onConverted,
  onlineAgents = [],
  currentAgentEmail,
  onTransfer,
}: {
  room: ChatRoom;
  onClose: () => void;
  onConverted?: (customerId: string) => void;
  onlineAgents?: OnlineAgent[];
  currentAgentEmail?: string;
  onTransfer?: (email: string) => void;
}) {
  const meta = statusMeta[room.status];
  const presence = presenceMeta[room.clientPresence ?? 'offline'];
  const name = room.clientName || room.clientEmail;
  const [infoOpen, setInfoOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  // 转接候选：在线坐席中排除自己
  const transferCandidates = onlineAgents.filter((a) => a.email !== currentAgentEmail);

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <div className="relative shrink-0">
          <Avatar className="border-border/40 h-10 w-10 rounded-2xl border sm:h-12 sm:w-12 sm:rounded-3xl">
            <AvatarFallback className="bg-primary/15 text-primary rounded-2xl text-sm font-semibold sm:rounded-3xl sm:text-base">
              {initials(room.clientName, room.clientEmail)}
            </AvatarFallback>
          </Avatar>
          <span
            className={cn(
              'border-background absolute right-0 bottom-0 inline-flex h-3 w-3 rounded-full border-2 sm:h-3.5 sm:w-3.5',
              presence.dot,
            )}
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold sm:text-base">{name}</p>
          <p className="text-muted-foreground truncate text-xs sm:text-sm">
            {room.clientEmail} · {meta.label} · {presence.label}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Popover open={infoOpen} onOpenChange={setInfoOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="访客信息"
              className="border-border/40 bg-background/60 text-muted-foreground hover:bg-muted/60 focus-visible:ring-primary/40 focus-visible:ring-offset-background size-8 rounded-full border transition focus-visible:ring-2 focus-visible:ring-offset-2 sm:size-10"
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
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="语音通话"
          className="border-border/40 bg-background/60 text-muted-foreground hover:bg-muted/60 focus-visible:ring-primary/40 focus-visible:ring-offset-background size-8 rounded-full border transition focus-visible:ring-2 focus-visible:ring-offset-2 sm:size-10"
        >
          <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="视频通话"
          className="border-border/40 bg-background/60 text-muted-foreground hover:bg-muted/60 focus-visible:ring-primary/40 focus-visible:ring-offset-background size-8 rounded-full border transition focus-visible:ring-2 focus-visible:ring-offset-2 sm:size-10"
        >
          <Video className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
        {/* 转接（P1 H3）：选择其他在线坐席将会话重新分配 */}
        <Popover open={transferOpen} onOpenChange={setTransferOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="转接会话"
              disabled={room.status === 'closed'}
              className="border-border/40 bg-background/60 text-muted-foreground hover:bg-muted/60 focus-visible:ring-primary/40 focus-visible:ring-offset-background size-8 rounded-full border transition focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-40 sm:size-10"
            >
              <ArrowLeftRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-1.5">
            <p className="text-muted-foreground px-2 py-1.5 text-xs font-medium">转接给</p>
            {transferCandidates.length === 0 ? (
              <p className="text-muted-foreground px-2 py-2 text-xs">当前没有其他在线坐席</p>
            ) : (
              transferCandidates.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => {
                    onTransfer?.(a.email);
                    setTransferOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition hover:bg-muted"
                >
                  <span
                    className={cn(
                      'inline-block h-2 w-2 shrink-0 rounded-full',
                      presenceMeta[a.status].dot,
                    )}
                  />
                  <span className="flex-1 truncate text-left">{a.email}</span>
                </button>
              ))
            )}
          </PopoverContent>
        </Popover>
        {room.status !== 'closed' ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="结束会话"
            onClick={onClose}
            className="border-border/40 bg-background/60 text-destructive hover:bg-destructive/10 focus-visible:ring-destructive/40 focus-visible:ring-offset-background size-8 rounded-full border transition focus-visible:ring-2 focus-visible:ring-offset-2 sm:size-10"
          >
            <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="更多操作"
            className="border-border/40 bg-background/60 text-muted-foreground hover:bg-muted/60 focus-visible:ring-primary/40 focus-visible:ring-offset-background size-8 rounded-full border transition focus-visible:ring-2 focus-visible:ring-offset-2 sm:size-10"
          >
            <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        )}
      </div>
    </header>
  );
}
