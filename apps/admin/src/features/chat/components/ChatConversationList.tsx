'use client';

import {
  Avatar,
  AvatarFallback,
  cn,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@tzj/ui';
import { Archive, Check, CheckSquare, ChevronDown, Loader2, Search, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { BatchChatRoomAction } from '../api';
import { useChatPresence } from '../ChatPresenceProvider';
import type { ChatRoom, ChatRoomStatusKey, PresenceStatus } from '../types';
import { VirtualList } from './VirtualList';

const ROW_HEIGHT = 84;

const statusDot: Record<ChatRoomStatusKey, string> = {
  waiting: 'bg-amber-500',
  active: 'bg-emerald-500',
  closed: 'bg-zinc-400',
  archived: 'bg-zinc-300',
};

const presenceDot: Record<PresenceStatus, string> = {
  online: 'bg-emerald-500',
  away: 'bg-amber-500',
  offline: 'bg-zinc-400',
};

const agentStatusMeta: Record<PresenceStatus, { label: string; dot: string }> = {
  online: { label: '在线', dot: 'bg-emerald-500' },
  away: { label: '离开', dot: 'bg-amber-500' },
  offline: { label: '离线', dot: 'bg-zinc-400' },
};

const BUCKETS: { key: ChatRoomStatusKey | 'closed'; label: string }[] = [
  { key: 'waiting', label: '待处理' },
  { key: 'active', label: '进行中' },
  { key: 'closed', label: '已关闭' },
];

function initials(name?: string, email?: string) {
  const base = (name ?? email ?? '?').trim();
  return base.slice(0, 1).toUpperCase() || '?';
}

function previewOf(room: ChatRoom): string {
  const lm = room.lastMessage;
  if (!lm) return '暂无消息';
  const prefix = lm.sender === 'agent' ? '客服: ' : '访客: ';
  const body = lm.content?.trim() || (lm.attachmentCount > 0 ? '[附件]' : '');
  return prefix + (body || '（空消息）');
}

function timeOf(room: ChatRoom): string {
  const ts = room.lastMessage?.timestamp ?? room.lastActivity;
  try {
    return new Date(ts).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export interface BucketView {
  rooms: ChatRoom[];
  cursor: string | null;
  hasMore: boolean;
  loading: boolean;
  loaded: boolean;
}

export type BucketKey = 'waiting' | 'active' | 'closed';

interface Props {
  buckets: Record<BucketKey, BucketView>;
  bucketCounts: Record<BucketKey, number>;
  activeBucket: BucketKey;
  onBucketChange: (b: BucketKey) => void;
  search: string;
  onSearch: (s: string) => void;
  selectedId: string | null;
  onSelect: (roomId: string) => void;
  onLoadMore: () => void;
  loadingMore: boolean;
  selectMode: boolean;
  selectedRoomIds: Set<string>;
  onToggleSelect: (roomId: string) => void;
  onEnterSelectMode: () => void;
  onExitSelectMode: () => void;
  onSelectAllOnPage: () => void;
  onBatchAction: (action: BatchChatRoomAction) => void;
}

export function ChatConversationList({
  buckets,
  bucketCounts,
  activeBucket,
  onBucketChange,
  search,
  onSearch,
  selectedId,
  onSelect,
  onLoadMore,
  loadingMore,
  selectMode,
  selectedRoomIds,
  onToggleSelect,
  onEnterSelectMode,
  onExitSelectMode,
  onSelectAllOnPage,
  onBatchAction,
}: Props) {
  const view = buckets[activeBucket];
  const rooms = view.rooms;
  const selectedCount = selectedRoomIds.size;
  const [statusOpen, setStatusOpen] = useState(false);
  const { agentStatus, setPresence } = useChatPresence();

  const emptyHint = useMemo(() => {
    if (search.trim()) return '未找到匹配的会话';
    if (activeBucket === 'waiting') return '暂无待处理会话';
    if (activeBucket === 'active') return '暂无进行中的会话';
    return '暂无已关闭的会话';
  }, [search, activeBucket]);

  return (
    <div className="border-border/40 bg-background/75 flex h-full flex-col gap-3 overflow-hidden rounded-2xl border p-3 backdrop-blur lg:rounded-3xl lg:p-4">
      {/* 头部：标题 + 我的状态 */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">会话列表</p>
          <p className="text-muted-foreground text-xs">
            {rooms.length} 个会话
            {selectMode && selectedCount > 0 ? ` · 已选 ${selectedCount}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!selectMode ? (
            <button
              type="button"
              onClick={onEnterSelectMode}
              className="text-muted-foreground border-border/50 rounded-full border px-3 py-1 text-[0.7rem] font-medium transition hover:bg-muted"
            >
              批量管理
            </button>
          ) : (
            <button
              type="button"
              onClick={onExitSelectMode}
              className="text-muted-foreground rounded-full px-2 py-1 text-[0.7rem] font-medium transition hover:bg-muted"
            >
              取消
            </button>
          )}
          <Popover open={statusOpen} onOpenChange={setStatusOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="切换我的在线状态"
                className="border-border/50 bg-primary/10 text-primary flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.7rem] font-medium tracking-wide transition hover:bg-primary/15"
              >
                <span
                  className={cn(
                    'inline-block h-2 w-2 rounded-full',
                    agentStatusMeta[agentStatus].dot,
                  )}
                />
                {agentStatusMeta[agentStatus].label}
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 p-1.5">
              <p className="text-muted-foreground px-2 py-1.5 text-xs font-medium">我的状态</p>
              {(['online', 'away', 'offline'] as PresenceStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setPresence(s);
                    setStatusOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition hover:bg-muted',
                    agentStatus === s && 'bg-muted/60',
                  )}
                >
                  <span
                    className={cn('inline-block h-2 w-2 rounded-full', agentStatusMeta[s].dot)}
                  />
                  <span className="flex-1 text-left">{agentStatusMeta[s].label}</span>
                  {agentStatus === s && <Check className="text-primary h-3.5 w-3.5" />}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* 批量操作条 */}
      {selectMode && (
        <div className="bg-primary/10 border-primary/30 flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs">
          <button
            type="button"
            onClick={onSelectAllOnPage}
            className="text-primary flex items-center gap-1.5 font-medium"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            全选本页（{rooms.length}）
          </button>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onBatchAction('close')}
              disabled={selectedCount === 0}
              className="rounded-md bg-background px-2.5 py-1 font-medium disabled:opacity-40"
            >
              关闭
            </button>
            <button
              type="button"
              onClick={() => onBatchAction('archive')}
              disabled={selectedCount === 0}
              className="flex items-center gap-1 rounded-md bg-background px-2.5 py-1 font-medium disabled:opacity-40"
            >
              <Archive className="h-3.5 w-3.5" />
              归档
            </button>
            <button
              type="button"
              onClick={() => onBatchAction('delete')}
              disabled={selectedCount === 0}
              className="text-destructive flex items-center gap-1 rounded-md bg-background px-2.5 py-1 font-medium disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </button>
          </div>
        </div>
      )}

      {/* 状态分桶 tabs */}
      <div className="flex items-center gap-1 rounded-xl bg-muted/50 p-1">
        {BUCKETS.map((b) => {
          const isActive = activeBucket === b.key;
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => onBucketChange(b.key as BucketKey)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {b.label}
              <span
                className={cn(
                  'rounded-full px-1.5 text-[0.65rem] font-semibold',
                  isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                {bucketCounts[b.key as BucketKey] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* 搜索 */}
      <div className="relative">
        <Search className="text-muted-foreground/70 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="搜索访客或邮箱"
          className="border-border/40 bg-background/60 w-full rounded-2xl pl-10 text-sm focus-visible:ring-primary/40 focus-visible:ring-2"
        />
      </div>

      {/* 列表（虚拟滚动） */}
      <VirtualList
        items={rooms}
        rowHeight={ROW_HEIGHT}
        className="min-h-0 flex-1"
        empty={<p className="text-muted-foreground py-10 text-center text-xs">{emptyHint}</p>}
        renderRow={(room: ChatRoom) => {
          const isActive = room.roomId === selectedId;
          const unread = room.unreadCountForAgent;
          const isArchived = room.status === 'archived';
          return (
            <button
              type="button"
              onClick={() => (selectMode ? onToggleSelect(room.roomId) : onSelect(room.roomId))}
              aria-current={isActive ? 'true' : undefined}
              className={cn(
                'focus-visible:ring-primary/50 flex h-full w-full items-start gap-3 rounded-2xl border border-transparent p-3 text-left transition focus-visible:ring-2 focus-visible:outline-none',
                isActive
                  ? 'border-primary/40 bg-primary/10'
                  : 'bg-background/70 hover:border-border/40 hover:bg-muted/40',
                selectMode && selectedRoomIds.has(room.roomId) && 'bg-primary/15',
              )}
            >
              {selectMode && (
                <span
                  className={cn(
                    'mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                    selectedRoomIds.has(room.roomId)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border',
                  )}
                >
                  {selectedRoomIds.has(room.roomId) && <Check className="h-3 w-3" />}
                </span>
              )}
              <div className="relative shrink-0">
                <Avatar className="border-border/40 bg-background/80 h-10 w-10 rounded-2xl border">
                  <AvatarFallback className="bg-primary/15 text-primary rounded-2xl text-sm font-medium">
                    {initials(room.clientName, room.clientEmail)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    'border-background absolute right-0 bottom-0 inline-flex h-3 w-3 rounded-full border-2',
                    room.clientPresence ? presenceDot[room.clientPresence] : statusDot[room.status],
                  )}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {room.clientName || room.clientEmail}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">{room.clientEmail}</p>
                  </div>
                  <span className="text-muted-foreground shrink-0 text-[0.65rem]">
                    {timeOf(room)}
                  </span>
                </div>
                <p className="text-muted-foreground line-clamp-1 text-xs">{previewOf(room)}</p>
              </div>
              {unread > 0 && (
                <span className="bg-primary text-primary-foreground ml-1 inline-flex min-h-[1.5rem] min-w-[1.5rem] items-center justify-center rounded-full text-[0.7rem] font-semibold shadow-lg">
                  {unread}
                </span>
              )}
              {isArchived && (
                <span className="text-muted-foreground shrink-0 self-center text-[0.6rem]">
                  已归档
                </span>
              )}
            </button>
          );
        }}
      />

      {/* 加载更多（P1 游标分页） */}
      {view.hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="text-primary border-border/40 flex items-center justify-center gap-2 rounded-2xl border py-2 text-xs font-medium transition hover:bg-muted/40 disabled:opacity-60"
        >
          {loadingMore ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              加载中…
            </>
          ) : (
            '加载更多'
          )}
        </button>
      )}
    </div>
  );
}
