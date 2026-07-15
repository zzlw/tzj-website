'use client';

import { Loader2, MessageSquare } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '@/components/session';
import {
  type BatchChatRoomAction,
  batchChatRooms,
  closeChatRoom,
  getChatRoom,
  getChatRooms,
  getChatStats,
  updateChatRoom,
} from './api';
import { useChatPresence } from './ChatPresenceProvider';
import { ChatArea } from './components/ChatArea';
import {
  type BucketKey,
  type BucketView,
  ChatConversationList,
} from './components/ChatConversationList';
import type { ChatMessage, ChatRoom } from './types';

const QUICK_REPLIES = [
  '您好，拓之迹客服很高兴为您服务，请问有什么可以帮您？',
  '稍等，我帮您查询一下。',
  '已为您记录，我们会尽快跟进处理。',
  '感谢您的咨询，还有其他需要帮助的吗？',
];

const ROOM_QUERY_KEY = 'room';
const PAGE_SIZE = 20;

/** 各分桶对应的后端 status 过滤（已关闭桶含归档） */
const BUCKET_STATUSES: Record<BucketKey, string> = {
  waiting: 'waiting',
  active: 'active',
  closed: 'closed,archived',
};

function byRecency(a: ChatRoom, b: ChatRoom): number {
  const ta = a.lastMessage
    ? new Date(a.lastMessage.timestamp).getTime()
    : new Date(a.lastActivity).getTime();
  const tb = b.lastMessage
    ? new Date(b.lastMessage.timestamp).getTime()
    : new Date(b.lastActivity).getTime();
  return tb - ta;
}

/** 合并拉取的列表项，保留已打开会话的完整 messages（避免重复请求） */
function mergeRooms(existing: ChatRoom[], incoming: ChatRoom[]): ChatRoom[] {
  const map = new Map(existing.map((r) => [r.roomId, r]));
  for (const r of incoming) {
    const prev = map.get(r.roomId);
    if (
      prev &&
      prev.messages &&
      prev.messages.length > 0 &&
      (!r.messages || r.messages.length === 0)
    ) {
      map.set(r.roomId, { ...r, messages: prev.messages });
    } else {
      map.set(r.roomId, r);
    }
  }
  return Array.from(map.values()).sort(byRecency);
}

function emptyBucket(): BucketView {
  return { rooms: [], cursor: null, hasMore: false, loading: false, loaded: false };
}

export function ChatMessenger() {
  const session = useSession();
  const agentEmail = session.username || 'agent@tzj.com';
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomParam = searchParams.get(ROOM_QUERY_KEY);

  const [buckets, setBuckets] = useState<Record<BucketKey, BucketView>>({
    waiting: emptyBucket(),
    active: emptyBucket(),
    closed: emptyBucket(),
  });
  const [bucketCounts, setBucketCounts] = useState<Record<BucketKey, number>>({
    waiting: 0,
    active: 0,
    closed: 0,
  });
  const [activeBucket, setActiveBucket] = useState<BucketKey>('waiting');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState('');

  const { socket } = useChatPresence();

  // 始终最新的快照，供 socket 回调 / fetch 读取
  const bucketsRef = useRef(buckets);
  bucketsRef.current = buckets;
  const searchRef = useRef(search);
  searchRef.current = search;
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoaded = useRef(false);

  const patchRoom = useCallback((roomId: string, patch: Partial<ChatRoom>) => {
    setBuckets((prev) => {
      const next = { ...prev };
      (Object.keys(next) as BucketKey[]).forEach((k) => {
        next[k] = {
          ...next[k],
          rooms: next[k].rooms.map((r) => (r.roomId === roomId ? { ...r, ...patch } : r)),
        };
      });
      return next;
    });
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const stats = await getChatStats();
      setBucketCounts({
        waiting: stats.statusBreakdown.waiting ?? 0,
        active: stats.statusBreakdown.active ?? 0,
        closed: (stats.statusBreakdown.closed ?? 0) + (stats.statusBreakdown.archived ?? 0),
      });
    } catch {
      /* 忽略 */
    }
  }, []);

  const fetchBucket = useCallback(async (bucket: BucketKey, opts?: { reset?: boolean }) => {
    const reset = opts?.reset ?? true;
    const cur = bucketsRef.current[bucket];
    if (cur.loading) return;
    setBuckets((prev) => ({
      ...prev,
      [bucket]: { ...prev[bucket], loading: true },
    }));
    try {
      const data = await getChatRooms({
        status: BUCKET_STATUSES[bucket],
        search: searchRef.current || undefined,
        cursor: reset ? undefined : (cur.cursor ?? undefined),
        take: PAGE_SIZE,
      });
      setBuckets((prev) => {
        const target = prev[bucket];
        const merged = reset ? data.rooms : mergeRooms(target.rooms, data.rooms);
        return {
          ...prev,
          [bucket]: {
            ...target,
            rooms: merged,
            cursor: data.nextCursor,
            hasMore: data.nextCursor != null,
            loading: false,
            loaded: true,
          },
        };
      });
    } catch {
      setBuckets((prev) => ({
        ...prev,
        [bucket]: { ...prev[bucket], loading: false },
      }));
    }
  }, []);

  const scheduleRefetchLive = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(() => {
      // reset: false → 走 mergeRooms，保留 socket 已到达的本地消息
      // 避免「消息收到后立即消失」的竞态
      void fetchBucket('waiting', { reset: false });
      void fetchBucket('active', { reset: false });
      if (bucketsRef.current.closed.loaded) void fetchBucket('closed', { reset: false });
      void fetchStats();
    }, 600);
  }, [fetchBucket, fetchStats]);

  /* ── 初始 / 搜索变化：拉取三个分桶首页 + 统计（防抖） ── */
  useEffect(() => {
    const t = setTimeout(async () => {
      await Promise.all([
        fetchBucket('waiting'),
        fetchBucket('active'),
        fetchBucket('closed'),
        fetchStats(),
      ]);
      if (!initialLoaded.current) {
        initialLoaded.current = true;
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [search, fetchBucket, fetchStats]);

  /* ── 切换分桶：未加载过则补拉 ── */
  useEffect(() => {
    if (!buckets[activeBucket].loaded) void fetchBucket(activeBucket);
    // 仅在选择变化时触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBucket]);

  /* ── Socket 实时事件 ── */
  const handleRoomList = useCallback(() => {
    scheduleRefetchLive();
  }, [scheduleRefetchLive]);

  const handleNewMessage = useCallback(
    (payload: { message: ChatMessage; room: Partial<ChatRoom> }) => {
      const { message, room } = payload;
      patchRoom(room.roomId as string, {
        lastActivity: (room.lastActivity as string) ?? undefined,
        status: room.status as ChatRoom['status'],
        unreadCountForAgent: room.unreadCountForAgent ?? 0,
        unreadCountForClient: room.unreadCountForClient ?? 0,
        assignedAgentEmail: room.assignedAgentEmail ?? undefined,
      });
      // 打开中的会话：直接追加消息，保证实时感（无需等 refetch）
      setBuckets((prev) => {
        const next = { ...prev };
        (Object.keys(next) as BucketKey[]).forEach((k) => {
          next[k] = {
            ...next[k],
            rooms: next[k].rooms.map((r) => {
              if (r.roomId !== room.roomId) return r;
              const has = (r.messages ?? []).some((m) => m.messageId === message.messageId);
              return {
                ...r,
                messages: has ? (r.messages ?? []) : [...(r.messages ?? []), message],
              };
            }),
          };
        });
        return next;
      });
      scheduleRefetchLive();
    },
    [patchRoom, scheduleRefetchLive],
  );

  const handleStatusChanged = useCallback(
    (payload: { roomId: string; status: string; assignedAgentEmail?: string }) => {
      patchRoom(payload.roomId, {
        status: payload.status as ChatRoom['status'],
        assignedAgentEmail: payload.assignedAgentEmail ?? undefined,
      });
      scheduleRefetchLive();
      void fetchStats();
    },
    [patchRoom, scheduleRefetchLive, fetchStats],
  );

  const handleMessagesRead = useCallback(
    (payload: {
      roomId: string;
      userType: 'client' | 'agent';
      userEmail?: string;
      messageIds?: string[];
      room: Partial<ChatRoom>;
    }) => {
      const { roomId, userType, userEmail, messageIds, room } = payload;
      setBuckets((prev) => {
        const next = { ...prev };
        (Object.keys(next) as BucketKey[]).forEach((k) => {
          next[k] = {
            ...next[k],
            rooms: next[k].rooms.map((r) => {
              if (r.roomId !== roomId) return r;
              let messages = r.messages ?? [];
              if (messageIds && messageIds.length > 0 && messages.length > 0) {
                const idSet = new Set(messageIds);
                const readAt =
                  (room?.lastReadByClient as string | undefined) ?? new Date().toISOString();
                messages = messages.map((m) => {
                  if (!idSet.has(m.messageId)) return m;
                  const receipts = m.readBy ?? [];
                  if (receipts.some((x) => x.userType === userType)) return m;
                  return {
                    ...m,
                    readBy: [...receipts, { userEmail: userEmail ?? '', userType, readAt }],
                  };
                });
              }
              return {
                ...r,
                messages,
                unreadCountForAgent: room?.unreadCountForAgent ?? r.unreadCountForAgent,
                unreadCountForClient: room?.unreadCountForClient ?? r.unreadCountForClient,
              };
            }),
          };
        });
        return next;
      });
    },
    [],
  );

  const handlePresenceChanged = useCallback(
    (payload: {
      userEmail: string;
      userType: 'client' | 'agent';
      status: 'online' | 'away' | 'offline';
    }) => {
      if (payload.userType !== 'client') return;
      setBuckets((prev) => {
        const next = { ...prev };
        (Object.keys(next) as BucketKey[]).forEach((k) => {
          next[k] = {
            ...next[k],
            rooms: next[k].rooms.map((r) =>
              r.clientEmail === payload.userEmail ? { ...r, clientPresence: payload.status } : r,
            ),
          };
        });
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    socket.on('room-list-updated', handleRoomList);
    socket.on('new-message', handleNewMessage);
    socket.on('room-status-changed', handleStatusChanged);
    socket.on('messages-read', handleMessagesRead);
    socket.on('presence-changed', handlePresenceChanged);
    socket.on('error', () => {
      if (!initialLoaded.current) setLoading(false);
    });
    return () => {
      socket.off('room-list-updated');
      socket.off('new-message');
      socket.off('room-status-changed');
      socket.off('messages-read');
      socket.off('presence-changed');
      socket.off('error');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleRoomList, handleNewMessage, handleStatusChanged, handleMessagesRead]);

  const selectedRoom = useMemo(() => {
    for (const k of Object.keys(buckets) as BucketKey[]) {
      const found = buckets[k].rooms.find((r) => r.roomId === selectedId);
      if (found) return found;
    }
    return null;
  }, [buckets, selectedId]);

  const selectedRoomRef = useRef<ChatRoom | null>(null);
  selectedRoomRef.current = selectedRoom;

  const handleSelect = useCallback(
    async (roomId: string) => {
      setSelectedId(roomId);
      const next = new URLSearchParams(searchParams.toString());
      next.set(ROOM_QUERY_KEY, roomId);
      router.replace(`?${next.toString()}`, { scroll: false });
      socket.joinRoom(roomId);
      socket.markRead(roomId);
      patchRoom(roomId, { unreadCountForAgent: 0 });
      try {
        const room = await getChatRoom(roomId);
        // 合并消息：保留 socket 已到达的本地消息 + 服务端返回的全量消息（去重按 messageId）
        // 避免因服务端最终一致性延迟导致刚到的消息被覆盖丢失
        setBuckets((prev) => {
          const next = { ...prev };
          (Object.keys(next) as BucketKey[]).forEach((k) => {
            next[k] = {
              ...next[k],
              rooms: next[k].rooms.map((r) => {
                if (r.roomId !== roomId) return r;
                const map = new Map<string, ChatMessage>();
                for (const m of r.messages ?? []) map.set(m.messageId, m);
                for (const m of room.messages ?? []) map.set(m.messageId, m);
                const merged = Array.from(map.values()).sort(
                  (a, b) =>
                    new Date(a.timestamp).getTime() -
                    new Date(b.timestamp).getTime(),
                );
                return {
                  ...r,
                  messages: merged,
                  status: room.status,
                  assignedAgentEmail: room.assignedAgentEmail,
                  notes: room.notes,
                  // 画像字段：列表项已带，全量拉取时一并同步
                  ipMasked: room.ipMasked,
                  country: room.country,
                  region: room.region,
                  city: room.city,
                  deviceType: room.deviceType,
                  browser: room.browser,
                  os: room.os,
                  referrer: room.referrer,
                  referrerHost: room.referrerHost,
                  landingPath: room.landingPath,
                  source: room.source,
                  clientPresence: room.clientPresence,
                };
              }),
            };
          });
          return next;
        });
      } catch {
        /* 忽略：socket 推送会补充消息 */
      }
    },
    [socket, patchRoom, router, searchParams],
  );

  const handleSend = useCallback(() => {
    if (!selectedRoom) return;
    const content = draft.trim();
    if (!content) return;
    socket.sendMessage(selectedRoom.roomId, content);
    setDraft('');
  }, [selectedRoom, draft, socket]);

  const handleClose = useCallback(async () => {
    if (!selectedRoomRef.current) return;
    const roomId = selectedRoomRef.current.roomId;
    socket.updateStatus(roomId, 'closed', agentEmail);
    patchRoom(roomId, { status: 'closed' });
    try {
      await closeChatRoom(roomId, agentEmail);
    } catch {
      /* 忽略 */
    }
    scheduleRefetchLive();
    void fetchStats();
  }, [socket, agentEmail, patchRoom, scheduleRefetchLive, fetchStats]);

  const handleQuickReply = useCallback(
    (text: string) => {
      if (!selectedRoomRef.current || !text.trim()) return;
      socket.sendMessage(selectedRoomRef.current.roomId, text);
    },
    [socket],
  );

  const handleConverted = useCallback(
    (customerId: string) => {
      if (!selectedRoomRef.current) return;
      patchRoom(selectedRoomRef.current.roomId, { customerId });
    },
    [patchRoom],
  );

  const handleLoadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    await fetchBucket(activeBucket, { reset: false });
    setLoadingMore(false);
  }, [activeBucket, fetchBucket, loadingMore]);

  const toggleSelect = useCallback((roomId: string) => {
    setSelectedRoomIds((prev) => {
      const n = new Set(prev);
      if (n.has(roomId)) n.delete(roomId);
      else n.add(roomId);
      return n;
    });
  }, []);

  const selectAllOnPage = useCallback(() => {
    setSelectedRoomIds(new Set(buckets[activeBucket].rooms.map((r) => r.roomId)));
  }, [buckets, activeBucket]);

  const handleBatchAction = useCallback(
    async (action: BatchChatRoomAction) => {
      const ids = [...selectedRoomIds];
      if (ids.length === 0) return;
      try {
        await batchChatRooms(action, ids);
      } catch {
        /* 忽略 */
      }
      setSelectedRoomIds(new Set());
      setSelectMode(false);
      await Promise.all([
        fetchBucket('waiting'),
        fetchBucket('active'),
        fetchBucket('closed'),
        fetchStats(),
      ]);
    },
    [selectedRoomIds, fetchBucket, fetchStats],
  );

  // 刷新后自动恢复：URL 带 ?room=xxx 时，rooms 加载完成后自动选中
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    if (selectedId !== null) {
      restoredRef.current = true;
      return;
    }
    if (!initialLoaded.current) return;
    restoredRef.current = true;
    if (roomParam) void handleSelect(roomParam);
  }, [initialLoaded.current, selectedId, roomParam, handleSelect]);

  if (loading && !initialLoaded.current) {
    return (
      <div className="border-border/50 bg-background/70 flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-2xl border backdrop-blur-xl lg:rounded-3xl">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        <p className="text-muted-foreground text-sm">正在加载会话…</p>
      </div>
    );
  }

  return (
    <div className="border-border/50 relative grid min-h-0 flex-1 w-full grid-rows-[auto_1fr] gap-3 overflow-hidden rounded-2xl border p-3 sm:gap-4 sm:p-4 lg:grid-rows-[1fr] lg:[grid-template-columns:minmax(280px,30%)_1fr] lg:gap-4 lg:rounded-3xl lg:p-5">
      <div
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-background/70 backdrop-blur-xl"
        aria-hidden
      />
      <ChatConversationList
        buckets={buckets}
        bucketCounts={bucketCounts}
        activeBucket={activeBucket}
        onBucketChange={setActiveBucket}
        search={search}
        onSearch={setSearch}
        selectedId={selectedId}
        onSelect={handleSelect}
        onLoadMore={handleLoadMore}
        loadingMore={loadingMore}
        selectMode={selectMode}
        selectedRoomIds={selectedRoomIds}
        onToggleSelect={toggleSelect}
        onEnterSelectMode={() => setSelectMode(true)}
        onExitSelectMode={() => {
          setSelectMode(false);
          setSelectedRoomIds(new Set());
        }}
        onSelectAllOnPage={selectAllOnPage}
        onBatchAction={handleBatchAction}
      />
      {selectedRoom ? (
        <ChatArea
          key={selectedRoom.roomId}
          room={{ ...selectedRoom, messages: selectedRoom.messages ?? [] }}
          draft={draft}
          onDraftChange={setDraft}
          onSend={handleSend}
          onClose={handleClose}
          quickReplies={QUICK_REPLIES}
          onQuickReply={handleQuickReply}
          onConverted={handleConverted}
        />
      ) : (
        <div className="border-border/40 bg-background/60 flex min-h-0 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-8 backdrop-blur lg:rounded-3xl">
          <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
            <MessageSquare className="text-muted-foreground h-5 w-5" />
          </div>
          <div className="text-center">
            <p className="text-foreground text-sm font-medium">从左侧选择一个会话开始服务</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {socket.connected
                ? `正在监听 ${buckets[activeBucket].rooms.length} 个会话`
                : '正在连接聊天服务…'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
