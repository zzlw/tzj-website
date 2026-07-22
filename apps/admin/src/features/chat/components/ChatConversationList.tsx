'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  cn,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@tzj/ui';
import { Archive, Check, CheckSquare, ChevronDown, ChevronLeft, Eye, Loader2, Search, Trash2, UserCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { BatchChatRoomAction } from '../api';
import { useChatPresence } from '../ChatPresenceProvider';
import type { ChatRoom, PresenceStatus } from '../types';
import { VirtualList } from './VirtualList';

const ROW_HEIGHT = 84;

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

/** 日常工作桶（LiveChat 模式：归档不作为平级 Tab，而是搜索行旁的独立图标入口） */
const BUCKETS: { key: BucketKey; label: string }[] = [
  { key: 'all', label: '全部' },
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

/** 列表行归属坐席芯片（业内最佳实践：Intercom/Zendesk 列表行用与周围文本等重的
    紧凑芯片——小字号 + 淡底色 + 区分自己/他人；完整账号资料卡在 ChatHeader hover 提供）。
    不用 LastOperatorCell：其 button 触发器会与行 button 嵌套冲突，字号也超出列表上下文。 */
function AssigneeChip({ room, currentAgentEmail }: { room: ChatRoom; currentAgentEmail?: string }) {
  const isMine = !!currentAgentEmail && room.assignedAgentEmail === currentAgentEmail;
  const user = room.assignedAgentUser;
  // 显示名：昵称 > 邮箱本地段（username 即邮箱，裸邮箱太长不适合芯片）
  const name = isMine
    ? '我'
    : user?.nickname?.trim() || (room.assignedAgentEmail ?? '').split('@')[0] || '坐席';
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium',
        isMine ? 'bg-primary/10 text-primary' : 'bg-sky-500/10 text-sky-600',
      )}
      title={isMine ? undefined : room.assignedAgentEmail}
    >
      {user?.avatar ? (
        <Avatar className="h-3.5 w-3.5">
          <AvatarImage src={user.avatar} alt={name} />
        </Avatar>
      ) : null}
      <span className="max-w-[5.5rem] truncate">{name}</span>
    </span>
  );
}

export interface BucketView {
  rooms: ChatRoom[];
  cursor: string | null;
  hasMore: boolean;
  loading: boolean;
  loaded: boolean;
}

export type BucketKey = 'all' | 'waiting' | 'active' | 'closed' | 'archived';

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
  /** 未读聚合总数（P2 M1），用于顶栏总未读徽标 */
  totalUnread?: number;
  /** 当前坐席邮箱（用于归属标签 + 仅我的筛选） */
  currentAgentEmail?: string;
  /** 「仅我的」筛选状态（由父组件通过 URL 持久化） */
  mineOnly?: boolean;
  onMineOnlyChange?: (v: boolean) => void;
  /** 是否有删除权限（chat.delete），无权限时隐藏删除按钮 */
  canDelete?: boolean;
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
  totalUnread = 0,
  currentAgentEmail,
  mineOnly = false,
  onMineOnlyChange,
  canDelete = false,
}: Props) {
  const view = buckets[activeBucket];
  const rooms = useMemo(
    () => (mineOnly && currentAgentEmail ? view.rooms.filter((r) => r.assignedAgentEmail === currentAgentEmail) : view.rooms),
    [view.rooms, mineOnly, currentAgentEmail],
  );
  const selectedCount = selectedRoomIds.size;
  const [statusOpen, setStatusOpen] = useState(false);
  const { agentStatus, setPresence } = useChatPresence();

  const emptyHint = useMemo(() => {
    if (search.trim()) return '未找到匹配的会话';
    if (activeBucket === 'all') return '暂无会话';
    if (activeBucket === 'waiting') return '暂无待处理会话';
    if (activeBucket === 'active') return '暂无进行中的会话';
    if (activeBucket === 'archived') return '暂无已归档的会话';
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
        <div className="flex items-center gap-1.5">
          {totalUnread > 0 && (
            <span className="bg-primary text-primary-foreground inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[0.65rem] font-semibold">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
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
            {canDelete && (
              <button
                type="button"
                onClick={() => onBatchAction('delete')}
                disabled={selectedCount === 0}
                className="text-destructive flex items-center gap-1 rounded-md bg-background px-2.5 py-1 font-medium disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                删除
              </button>
            )}
          </div>
        </div>
      )}

      {activeBucket === 'archived' ? (
        /* 归档视图（LiveChat Archive 模式）：冷存浏览态，隐藏日常 Tab/搜索，
           提供显式返回路径；搜索仍生效（URL 持久化），有搜索词时提示结果已过滤 */
        <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/30 px-3 py-2">
          <button
            type="button"
            onClick={() => onBucketChange('all')}
            className="text-muted-foreground flex items-center gap-0.5 text-xs font-medium transition hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            返回
          </button>
          <span className="h-3 w-px bg-border/60" aria-hidden />
          <Archive className="text-muted-foreground h-3.5 w-3.5" />
          <span className="text-xs font-medium">已归档</span>
          <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[0.65rem] font-semibold">
            {bucketCounts.archived ?? 0}
          </span>
          {search.trim() && (
            <span className="text-muted-foreground ml-auto text-[0.65rem]">已按搜索过滤</span>
          )}
        </div>
      ) : (
        <>
          {/* 状态分桶 tabs（日常工作桶：全部/待处理/进行中/已关闭）
              窄侧栏（~280px）下计数采用内联文本而非 pill 角标，确保 4 个 Tab 永不裁切 */}
          <div className="flex items-center justify-between gap-1 rounded-xl bg-muted/50 p-1">
            {BUCKETS.map((b) => {
              const isActive = activeBucket === b.key;
              return (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => onBucketChange(b.key as BucketKey)}
                  className={cn(
                    'flex items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-xs font-medium whitespace-nowrap transition',
                    isActive
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {b.label}
                  <span
                    className={cn(
                      'text-[0.6rem] font-semibold tabular-nums',
                      isActive ? 'text-primary' : 'text-muted-foreground/70',
                    )}
                  >
                    {bucketCounts[b.key as BucketKey] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 搜索 + 筛选 + 归档入口 */}
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="text-muted-foreground/70 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                type="search"
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="搜索访客或邮箱"
                className="border-border/40 bg-background/60 w-full rounded-2xl pl-10 text-sm focus-visible:ring-primary/40 focus-visible:ring-2"
              />
            </div>
            <button
              type="button"
              onClick={() => onMineOnlyChange?.(!mineOnly)}
              className={cn(
                'flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1.5 text-[0.7rem] font-medium transition',
                mineOnly
                  ? 'border-primary/40 bg-primary/15 text-primary'
                  : 'border-border/50 text-muted-foreground hover:bg-muted',
              )}
            >
              <UserCheck className="h-3 w-3" />
              仅我的
            </button>
            {/* 归档入口（LiveChat 模式：显式图标 + 独立计数，冷存降级展示） */}
            <button
              type="button"
              onClick={() => onBucketChange('archived')}
              title="已归档会话"
              aria-label={`已归档会话 ${bucketCounts.archived ?? 0} 个`}
              className="border-border/50 text-muted-foreground relative flex shrink-0 items-center justify-center rounded-full border p-1.5 transition hover:bg-muted"
            >
              <Archive className="h-3.5 w-3.5" />
              {(bucketCounts.archived ?? 0) > 0 && (
                <span className="bg-muted text-muted-foreground absolute -top-1 -right-1 inline-flex min-h-[0.875rem] min-w-[0.875rem] items-center justify-center rounded-full px-1 text-[0.55rem] font-semibold ring-2 ring-background">
                  {bucketCounts.archived}
                </span>
              )}
            </button>
          </div>
        </>
      )}

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
                    presenceDot[room.clientPresence ?? 'offline'],
                  )}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {room.clientName || room.clientEmail}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                        {room.clientEmail}
                      </p>
                      <span
                        className={cn(
                          'bg-emerald-500/10 text-emerald-600 inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium transition-opacity',
                          room.clientPanelOpen && room.clientPresence === 'online'
                            ? 'opacity-100'
                            : 'pointer-events-none opacity-0',
                        )}
                      >
                        <Eye className="h-2.5 w-2.5" />
                        正在查看对话
                      </span>
                    </div>
                  </div>
                  <span className="text-muted-foreground shrink-0 text-[0.65rem]">
                    {timeOf(room)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {/* 归属坐席芯片：与预览文本等重的轻量标签，行本身是点击目标，
                      不嵌套独立 hover 按钮；完整资料卡在 ChatHeader 提供 */}
                  {room.assignedAgentEmail ? (
                    <AssigneeChip room={room} currentAgentEmail={currentAgentEmail} />
                  ) : room.status === 'waiting' ? (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-zinc-500/10 px-1.5 py-0.5 text-[0.6rem] font-medium text-zinc-500">
                      未分配
                    </span>
                  ) : null}
                  <p className="text-muted-foreground min-w-0 flex-1 truncate text-xs">{previewOf(room)}</p>
                </div>
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
