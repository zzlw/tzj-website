'use client';

import { Avatar, AvatarFallback, Button, cn } from '@tzj/ui';
import { MoreVertical, Phone, Video, XCircle } from 'lucide-react';
import type { ChatRoom, ChatRoomStatusKey, PresenceStatus } from '../types';

const statusMeta: Record<ChatRoomStatusKey, { label: string; dot: string }> = {
  waiting: { label: '等待中', dot: 'bg-amber-500' },
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

export function ChatHeader({ room, onClose }: { room: ChatRoom; onClose: () => void }) {
  const meta = statusMeta[room.status];
  const presence = room.clientPresence ? presenceMeta[room.clientPresence] : null;
  const name = room.clientName || room.clientEmail;

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
              presence ? presence.dot : meta.dot,
            )}
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold sm:text-base">{name}</p>
          <p className="text-muted-foreground truncate text-xs sm:text-sm">
            {room.clientEmail} · {meta.label}
            {presence ? ` · ${presence.label}` : ''}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
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
