'use client';

import { Loader2, MessageSquare } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '@/components/session';
import { toast } from '@tzj/ui';
import {
  type BatchChatRoomAction,
  batchChatRooms,
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
import type { ChatMessage, ChatRoom, PresenceStatus } from './types';

const QUICK_REPLIES = [
  '您好，拓之迹客服很高兴为您服务，请问有什么可以帮您？',
  '稍等，我帮您查询一下。',
  '已为您记录，我们会尽快跟进处理。',
  '感谢您的咨询，还有其他需要帮助的吗？',
];

const ROOM_QUERY_KEY = 'room';
const BUCKET_QUERY_KEY = 'bucket';
const PAGE_SIZE = 20;

const VALID_BUCKETS: BucketKey[] = ['all', 'waiting', 'active', 'closed'];

/** 从 URL ?bucket= 读取初始分桶，非法/缺省回退到 all（全部） */
function readInitialBucket(search?: string | null): BucketKey {
  const v = new URLSearchParams(search ?? '').get(BUCKET_QUERY_KEY);
  return v && (VALID_BUCKETS as string[]).includes(v) ? (v as BucketKey) : 'all';
}

/** 各分桶对应的后端 status 过滤（已关闭桶含归档；all 为空 → 不传 status 返回全部） */
const BUCKET_STATUSES: Record<BucketKey, string> = {
  all: '',
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
    // HTTP 列表不含实时 clientPresence（presence 仅存于网关内存，由 socket
    // presence-changed 事件维护）。合并时保留已知状态，避免把 socket 刚推送的
    // 「离线」冲回 undefined（UI 兜底成绿色=在线）。
    const presence = r.clientPresence ?? prev?.clientPresence;
    if (
      prev &&
      prev.messages &&
      prev.messages.length > 0 &&
      (!r.messages || r.messages.length === 0)
    ) {
      map.set(r.roomId, { ...r, messages: prev.messages, clientPresence: presence });
    } else {
      map.set(r.roomId, { ...r, clientPresence: presence });
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
    all: emptyBucket(),
    waiting: emptyBucket(),
    active: emptyBucket(),
    closed: emptyBucket(),
  });
  const [bucketCounts, setBucketCounts] = useState<Record<BucketKey, number>>({
    all: 0,
    waiting: 0,
    active: 0,
    closed: 0,
  });
  const [activeBucket, setActiveBucket] = useState<BucketKey>(() =>
    readInitialBucket(searchParams.toString()),
  );
  // 切换分桶时同步 ?bucket= 到 URL，刷新后可恢复当前标签；
  // 用 history.replaceState 仅更新地址栏、不触发 RSC 请求（避免经 proxy 误判未登录）。
  const handleBucketChange = useCallback((bucket: BucketKey) => {
    setActiveBucket(bucket);
    if (typeof window !== 'undefined') {
      const next = new URLSearchParams(window.location.search);
      next.set(BUCKET_QUERY_KEY, bucket);
      window.history.replaceState(null, '', `?${next.toString()}`);
    }
  }, []);
  // 始终反映当前分桶（供 socket 回调中基于最新值判断，避免闭包捕获过期值）
  const activeBucketRef = useRef(activeBucket);
  activeBucketRef.current = activeBucket;
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

  // 房间状态变化时，将其从原桶迁移到新状态对应的桶。
  // 仅 patchRoom 更新 status 会让已变 active 的房间仍残留在 waiting 桶，
  // 而计数 fetchStats 反映真实分布，导致「列表有会话但计数为 0」的不一致。
  const moveRoomToBucket = useCallback(
    (roomId: string, newStatus: ChatRoom['status'], patch?: Partial<ChatRoom>) => {
      const target: BucketKey =
        newStatus === 'waiting' ? 'waiting' : newStatus === 'active' ? 'active' : 'closed';
      setBuckets((prev) => {
        const next = { ...prev };
        let moved: ChatRoom | undefined;
        // 「全部」桶始终包含所有会话，不受状态迁移影响：既不从中移除、也不新增到它，
        // 仅从其它具体状态桶（非 target）中移除该房间。
        (Object.keys(next) as BucketKey[]).forEach((k) => {
          if (k === 'all' || k === target) return;
          const room = next[k].rooms.find((r) => r.roomId === roomId);
          if (room) {
            moved = room;
            next[k] = {
              ...next[k],
              rooms: next[k].rooms.filter((r) => r.roomId !== roomId),
            };
          }
        });
        // 同步「全部」桶中该房间的状态字段（状态变化后在全部列表里也应反映）
        if (next.all.rooms.some((r) => r.roomId === roomId)) {
          next.all = {
            ...next.all,
            rooms: next.all.rooms.map((r) =>
              r.roomId === roomId ? { ...r, status: newStatus, ...(patch ?? {}) } : r,
            ),
          };
        }
        // 将房间加到 target 具体桶（若不在则置顶）
        const tgt = next[target];
        if (moved) {
          const updated: ChatRoom = { ...moved, status: newStatus, ...(patch ?? {}) };
          if (tgt.rooms.some((r) => r.roomId === roomId)) {
            next[target] = {
              ...tgt,
              rooms: tgt.rooms.map((r) => (r.roomId === roomId ? { ...r, ...updated } : r)),
            };
          } else {
            next[target] = { ...tgt, rooms: [updated, ...tgt.rooms] };
          }
        }
        return next;
      });
    },
    [],
  );

  const fetchStats = useCallback(async () => {
    try {
      const stats = await getChatStats();
      const waiting = stats.statusBreakdown.waiting ?? 0;
      const active = stats.statusBreakdown.active ?? 0;
      const closed = (stats.statusBreakdown.closed ?? 0) + (stats.statusBreakdown.archived ?? 0);
      setBucketCounts({
        all: waiting + active + closed,
        waiting,
        active,
        closed,
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
        // HTTP 列表不含实时 clientPresence（presence 仅存于网关内存，由 socket
        // presence-changed 事件维护）。重取时保留已知的在线状态，避免把 socket
        // 刚推送的「离线」冲回 undefined（UI 兜底成绿色=在线），表现为
        // 「关页后离线 1 秒又变在线」。
        const knownPresence = new Map<string, PresenceStatus>();
        (Object.keys(prev) as BucketKey[]).forEach((k) => {
          for (const r of prev[k].rooms) {
            if (r.clientPresence) knownPresence.set(r.roomId, r.clientPresence);
          }
        });
        const enriched = data.rooms.map((r) =>
          r.clientPresence ? r : { ...r, clientPresence: knownPresence.get(r.roomId) },
        );
        const merged = reset ? enriched : mergeRooms(target.rooms, enriched);
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
      if (bucketsRef.current.all.loaded) void fetchBucket('all', { reset: false });
      void fetchStats();
    }, 600);
  }, [fetchBucket, fetchStats]);

  /* ── 初始 / 搜索变化：拉取三个分桶首页 + 统计（防抖） ── */
  useEffect(() => {
    const t = setTimeout(async () => {
      await Promise.all([
        fetchBucket('all'),
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
  const handleRoomList = useCallback(
    (payload?: { rooms?: ChatRoom[] }) => {
      // 网关 broadcastRoomListUpdate / register-agent 推送的 rooms 已用内存
      // presence 注入 clientPresence（enrichRoomsWithPresence）。此前本处理器
      // 直接丢弃该 payload 并走 HTTP 重取，而 REST 列表不含实时 presence，导致
      // 「待处理」会话的访客真实在线状态丢失、回退到状态色（与 away 同色）。
      // 这里先把 socket 携带的 clientPresence 应用到本地，再触发 HTTP 重取
      // （重取会保留已知 presence），确保在线访客稳定显示绿点而非黄色状态色。
      if (payload?.rooms?.length) {
        const presenceById = new Map<string, PresenceStatus>();
        for (const r of payload.rooms) {
          if (r.clientPresence) presenceById.set(r.roomId, r.clientPresence);
        }
        if (presenceById.size) {
          setBuckets((prev) => {
            const next = { ...prev };
            (Object.keys(next) as BucketKey[]).forEach((k) => {
              next[k] = {
                ...next[k],
                rooms: next[k].rooms.map((r) =>
                  presenceById.has(r.roomId)
                    ? { ...r, clientPresence: presenceById.get(r.roomId)! }
                    : r,
                ),
              };
            });
            return next;
          });
        }
      }
      scheduleRefetchLive();
    },
    [scheduleRefetchLive],
  );

  const handleNewMessage = useCallback(
    (payload: { message: ChatMessage; room: Partial<ChatRoom> }) => {
      const { message, room } = payload;
      const isSelected = room.roomId === selectedIdRef.current;
      patchRoom(room.roomId as string, {
        lastActivity: (room.lastActivity as string) ?? undefined,
        status: room.status as ChatRoom['status'],
        // 正在查看的会话不计未读：后端 unaware agent 是否聚焦该会话，会正常累加，
        // 这里强制归零，避免列表徽标在当前会话上闪烁。
        unreadCountForAgent: isSelected ? 0 : (room.unreadCountForAgent ?? 0),
        unreadCountForClient: room.unreadCountForClient ?? 0,
        assignedAgentEmail: room.assignedAgentEmail ?? undefined,
      });
      // 当前会话收到对方新消息 → 立即上报已读，同步后端计数与已读回执
      if (isSelected && message.sender !== 'agent') {
        socket.markRead(room.roomId as string);
      }
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
    [patchRoom, scheduleRefetchLive, socket],
  );

  const handleStatusChanged = useCallback(
    (payload: {
      roomId: string;
      status: string;
      assignedAgentEmail?: string;
      reopened?: boolean;
    }) => {
      const isSelected = payload.roomId === selectedIdRef.current;
      moveRoomToBucket(payload.roomId, payload.status as ChatRoom['status'], {
        assignedAgentEmail: payload.assignedAgentEmail ?? undefined,
      });
      // 接入会话（waiting→active）时，若迁移的是当前选中的会话，自动切换到「进行中」桶，
      // 避免「tab 停在待处理、列表空了、会话却在进行中」的割裂感；
      // 但当前已在「全部」桶时无需切换（全部列表始终包含该会话）。
      // 关闭/归档不跟随：坐席留在进行中继续服务其他会话。
      if (
        payload.status === 'active' &&
        isSelected &&
        activeBucketRef.current !== 'all'
      ) {
        handleBucketChange('active');
      } else if (
        // 访客「回复即重开」：若坐席正停留在「已关闭」桶并查看该会话，重开后该会话被移出
        // closed 桶，须切到目标桶（active/waiting）使其仍在列表视野内、且输入框随之恢复可用。
        payload.reopened &&
        isSelected &&
        activeBucketRef.current === 'closed'
      ) {
        handleBucketChange(payload.status === 'active' ? 'active' : 'waiting');
      }
      // 访客重开已关闭会话：明确提示坐席，使其注意到「会话已重新打开、可继续回复」
      // （composer 已随 room.status 响应式恢复可输入，这里补一个显式信号）。
      if (payload.reopened) {
        const room = selectedRoomRef.current;
        const name = room?.clientName || room?.clientEmail || '访客';
        toast.info(`${name} 已重新打开会话，可继续回复`);
      }
      scheduleRefetchLive();
      void fetchStats();
    },
    [moveRoomToBucket, scheduleRefetchLive, fetchStats, handleBucketChange],
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
              if (messages.length > 0) {
                // messageIds 为空表示「标记全部」：client 发 mark-messages-read 时不传 messageIds，
                // 后端会标记所有对方消息已读，但推送的 messageIds 也为空，
                // 因此这里按 userType 推断对方 sender，标记所有对方发的消息为已读。
                const idSet = messageIds && messageIds.length > 0 ? new Set(messageIds) : null;
                const oppositeSender = userType === 'client' ? 'agent' : 'client';
                const readAt =
                  (room?.lastReadByClient as string | undefined) ?? new Date().toISOString();
                messages = messages.map((m) => {
                  const shouldMark = idSet ? idSet.has(m.messageId) : m.sender === oppositeSender;
                  if (!shouldMark) return m;
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
      roomId?: string;
    }) => {
      if (payload.userType !== 'client') return;
      setBuckets((prev) => {
        const next = { ...prev };
        (Object.keys(next) as BucketKey[]).forEach((k) => {
          next[k] = {
            ...next[k],
            rooms: next[k].rooms.map((r) => {
              // 带 roomId 的 presence（如访客加入某房间）只更新该房间；
              // 全局 presence（断开/超时离线）按 userEmail 应用到其所有房间。
              if (payload.roomId ? r.roomId === payload.roomId : r.clientEmail === payload.userEmail) {
                return { ...r, clientPresence: payload.status };
              }
              return r;
            }),
          };
        });
        return next;
      });
    },
    [],
  );

  /** 访客离开某房间（点「开始新会话」leave-room / 断开）→ 该房间置离线，
   *  不影响其在其它房间的在线状态。 */
  const handleUserLeft = useCallback((payload: { roomId?: string; userEmail?: string }) => {
    if (!payload.roomId) return;
    setBuckets((prev) => {
      const next = { ...prev };
      (Object.keys(next) as BucketKey[]).forEach((k) => {
        next[k] = {
          ...next[k],
          rooms: next[k].rooms.map((r) =>
            r.roomId === payload.roomId ? { ...r, clientPresence: 'offline' } : r,
          ),
        };
      });
      return next;
    });
  }, []);

  useEffect(() => {
    socket.on('room-list-updated', handleRoomList);
    socket.on('new-message', handleNewMessage);
    socket.on('room-status-changed', handleStatusChanged);
    socket.on('messages-read', handleMessagesRead);
    socket.on('presence-changed', handlePresenceChanged);
    socket.on('user-left', handleUserLeft);
    socket.on('error', () => {
      if (!initialLoaded.current) setLoading(false);
    });
    return () => {
      socket.off('room-list-updated');
      socket.off('new-message');
      socket.off('room-status-changed');
      socket.off('messages-read');
      socket.off('presence-changed');
      socket.off('user-left');
      socket.off('error');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    handleRoomList,
    handleNewMessage,
    handleStatusChanged,
    handleMessagesRead,
    handlePresenceChanged,
    handleUserLeft,
  ]);

  const selectedRoom = useMemo(() => {
    for (const k of Object.keys(buckets) as BucketKey[]) {
      const found = buckets[k].rooms.find((r) => r.roomId === selectedId);
      if (found) return found;
    }
    return null;
  }, [buckets, selectedId]);

  const selectedRoomRef = useRef<ChatRoom | null>(null);
  selectedRoomRef.current = selectedRoom;
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const handleSelect = useCallback(
    async (roomId: string) => {
      setSelectedId(roomId);
      // 基于 window.location.search 构造，保留已有的 ?bucket= 等参数
      // （history.replaceState 写入的 URL 不一定同步到 next 的 searchParams）。
      const current = typeof window !== 'undefined' ? window.location.search : searchParams.toString();
      const next = new URLSearchParams(current);
      next.set(ROOM_QUERY_KEY, roomId);
      // 用 history.replaceState 仅更新 URL（供刷新恢复选中），不触发 RSC 请求。
      // router.replace 会触发 RSC 请求经 proxy；该 RSC 请求在某些场景未携带 cookie，
      // 被 proxy 误判为未登录而 redirect /login，表现为「点会话即跳登录」。
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `?${next.toString()}`);
      }
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
                  // HTTP 详情不含实时 clientPresence，保留 socket 已推送的状态
                  clientPresence: room.clientPresence ?? r.clientPresence,
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
    // 经 socket 通知网关结束会话：网关复用 closeChatRoom 写入「会话已关闭」系统消息
    // 并实时广播 new-message，坐席/访客两端即时看到标签，无需刷新。
    // 不再走冗余的 HTTP closeChatRoom，避免与网关并发双写导致重复系统消息。
    socket.updateStatus(roomId, 'closed', agentEmail);
    patchRoom(roomId, { status: 'closed' });
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

      // 正在对话（ChatArea 已打开）的会话不允许被批量删除：
      // 删除是软删除，并不阻断客户继续发消息，但前端会因重拉列表把该房间移出本地
      // 状态，导致 ChatArea 卸载、new-message 无处落地 → 代理「收不到」客户消息。
      // 故跳过当前打开的会话，使其继续留在列表与聊天窗口、消息照常收发；
      // 其余勾选的会话照常删除。
      let targets = ids;
      if (action === 'delete') {
        const openId = selectedIdRef.current;
        if (openId && ids.includes(openId)) {
          targets = ids.filter((id) => id !== openId);
          toast.warning('当前正在对话的会话已跳过删除，请先结束会话再删除');
        }
      }
      if (targets.length === 0) {
        setSelectedRoomIds(new Set());
        setSelectMode(false);
        return;
      }

      try {
        await batchChatRooms(action, targets);
      } catch {
        /* 忽略 */
      }
      setSelectedRoomIds(new Set());
      setSelectMode(false);
      await Promise.all([
        fetchBucket('all'),
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

  // 若 URL 未带 bucket 参数，补写默认 ?bucket=all（保留已有 room 等参数），
  // 使地址栏明确反映当前分桶，刷新行为可预期。
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has(BUCKET_QUERY_KEY)) {
      params.set(BUCKET_QUERY_KEY, 'all');
      window.history.replaceState(null, '', `?${params.toString()}`);
    }
  }, []);

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
        onBucketChange={handleBucketChange}
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
