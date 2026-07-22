'use client';

/**
 * 访客档案抽屉（Intercom / Zendesk 访客 360° 模式）：
 * 从「访客会话」页点击访客弹出，展示该访客的全部聊天会话与消息记录（只读）。
 * 两级视图：会话列表 → 消息线程（顶部返回）。
 */
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, Skeleton, cn } from '@tzj/ui';
import { ArrowLeft, MessagesSquare } from 'lucide-react';
import { useState } from 'react';
import type { AnalyticsVisitorRow } from '@/features/analytics';
import { getChatRoom, getChatRooms } from '../api';
import type { ChatRoom, ChatRoomStatusKey } from '../types';
import { ChatMessageBubble } from './ChatMessageBubble';

const statusMeta: Record<ChatRoomStatusKey, { label: string; dot: string }> = {
  waiting: { label: '等待中', dot: 'bg-sky-500' },
  active: { label: '进行中', dot: 'bg-emerald-500' },
  closed: { label: '已关闭', dot: 'bg-zinc-400' },
  archived: { label: '已归档', dot: 'bg-zinc-300' },
};

function formatDateTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function previewOf(room: ChatRoom): string {
  const lm = room.lastMessage;
  if (!lm) return '暂无消息';
  const prefix = lm.sender === 'agent' ? '客服: ' : lm.sender === 'system' ? '' : '访客: ';
  const body = lm.content?.trim() || (lm.attachmentCount > 0 ? '[附件]' : '');
  return prefix + (body || '（空消息）');
}

/** 负责人轻量芯片（与列表 AssigneeChip 同一思路：纯 span、与文本等重） */
function AssigneeTag({ room }: { room: ChatRoom }) {
  if (!room.assignedAgentEmail) return null;
  const name =
    room.assignedAgentUser?.nickname?.trim() || room.assignedAgentEmail.split('@')[0] || '坐席';
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[0.6rem] font-medium text-sky-600"
      title={room.assignedAgentEmail}
    >
      {name}
    </span>
  );
}

interface Props {
  visitor: AnalyticsVisitorRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VisitorProfileSheet({ visitor, open, onOpenChange }: Props) {
  // 当前查看的会话 roomId；null = 会话列表级
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  // 会话列表：按 visitorId 查询 + 按 email 兜底合并（存量会话无 visitorId，已识别访客经邮箱找回）
  const roomsQuery = useQuery({
    queryKey: ['visitor-rooms', visitor?.visitorId, visitor?.email],
    queryFn: async () => {
      if (!visitor) return [];
      const byVisitorId = visitor.visitorId
        ? await getChatRooms({ visitorId: visitor.visitorId, take: 100 })
        : { rooms: [] as ChatRoom[] };
      let rooms = byVisitorId.rooms;
      if (visitor.email) {
        const byEmail = await getChatRooms({ clientEmail: visitor.email, take: 100 });
        const seen = new Set(rooms.map((r) => r.roomId));
        rooms = [...rooms, ...byEmail.rooms.filter((r) => !seen.has(r.roomId))];
      }
      // 按最后活跃时间倒序
      return [...rooms].sort(
        (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime(),
      );
    },
    enabled: open && !!visitor,
  });

  // 消息线程：打开具体会话时拉取完整消息
  const threadQuery = useQuery({
    queryKey: ['visitor-room-detail', activeRoomId],
    queryFn: () => getChatRoom(activeRoomId as string),
    enabled: open && !!activeRoomId,
  });

  const displayName = visitor?.name || visitor?.email || visitor?.phone || '匿名访客';

  function handleClose() {
    onOpenChange(false);
    // 关闭后重置到列表级，下次打开从头开始
    setActiveRoomId(null);
  }

  return (
    <Sheet open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <SheetContent side="right" className="flex w-[520px] max-w-[90vw] flex-col p-0 sm:max-w-[520px]">
        <SheetHeader className="border-b px-5 py-4">
          <div className="flex items-center gap-2">
            {activeRoomId && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="返回会话列表"
                onClick={() => setActiveRoomId(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <SheetTitle className="flex items-center gap-2 text-base">
              {displayName}
              {visitor &&
                (visitor.identified ? (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    已识别
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                    匿名
                  </Badge>
                ))}
            </SheetTitle>
          </div>
          <SheetDescription className="flex flex-wrap gap-x-2 text-xs">
            {visitor?.company ? <span>{visitor.company}</span> : null}
            {visitor?.email ? <span>{visitor.email}</span> : null}
            {visitor?.phone ? <span>{visitor.phone}</span> : null}
            {!activeRoomId && <span className="text-muted-foreground/70">共 {roomsQuery.data?.length ?? 0} 个聊天会话</span>}
          </SheetDescription>
        </SheetHeader>

        {/* ── 消息线程级 ── */}
        {activeRoomId ? (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {threadQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className={cn('h-14 w-3/4', i % 2 ? 'ml-auto' : '')} />
                ))}
              </div>
            ) : threadQuery.data ? (
              <div className="space-y-3">
                {(threadQuery.data.messages ?? []).map((m) => (
                  <ChatMessageBubble key={m.messageId} message={m} />
                ))}
                {(threadQuery.data.messages ?? []).length === 0 && (
                  <p className="text-muted-foreground py-8 text-center text-sm">暂无消息</p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground py-8 text-center text-sm">加载失败</p>
            )}
          </div>
        ) : (
          /* ── 会话列表级 ── */
          <div className="flex-1 overflow-y-auto">
            {roomsQuery.isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (roomsQuery.data ?? []).length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <MessagesSquare className="text-muted-foreground/40 h-10 w-10" />
                <p className="text-muted-foreground text-sm">该访客暂无聊天记录</p>
                <p className="text-muted-foreground/70 max-w-[280px] text-xs">
                  仅展示身份打通后创建的会话（访客端新版本上线后生效）
                </p>
              </div>
            ) : (
              <ul className="divide-y">
                {(roomsQuery.data ?? []).map((room) => {
                  const meta = statusMeta[room.status] ?? statusMeta.closed;
                  return (
                    <li key={room.roomId}>
                      <button
                        type="button"
                        className="hover:bg-muted/50 flex w-full flex-col gap-1 px-5 py-3 text-left transition-colors"
                        onClick={() => setActiveRoomId(room.roomId)}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', meta.dot)} />
                          <span className="text-xs font-medium">{meta.label}</span>
                          <span className="text-muted-foreground text-xs">{formatDateTime(room.lastActivity)}</span>
                          <span className="ml-auto" />
                          <AssigneeTag room={room} />
                        </div>
                        <p className="text-muted-foreground truncate text-xs">{previewOf(room)}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
