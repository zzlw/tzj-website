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
} from './api';
import { useChatPresence } from './ChatPresenceProvider';
import { ChatArea } from './components/ChatArea';
import {
  type BucketKey,
  type BucketView,
  ChatConversationList,
} from './components/ChatConversationList';
import type { OnlineAgent } from './useChatSocket';
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
  // 在线坐席花名册（P1 H3 转接目标）
  const [onlineAgents, setOnlineAgents] = useState<OnlineAgent[]>([]);
  // 当前访客是否正在输入（P1 H2）
  const [clientTyping, setClientTyping] = useState(false);
  // 未读聚合总数（P2 M1）
  const [totalUnread, setTotalUnread] = useState(0);
  const clientTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { socket } = useChatPresence();
  // requestNotificationCounts 稳定引用，避免 socket 对象每次渲染新引用导致依赖数组重新执行
  const reqNotifCountsRef = useRef(socket.requestNotificationCounts);
  reqNotifCountsRef.current = socket.requestNotificationCounts;

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
    refetchTimer.current = setTimeout(async () => {
      // reset: false → 走 mergeRooms，保留 socket 已到达的本地消息
      // 避免「消息收到后立即消失」的竞态
      void fetchBucket('waiting', { reset: false });
      void fetchBucket('active', { reset: false });
      if (bucketsRef.current.closed.loaded) void fetchBucket('closed', { reset: false });
      if (bucketsRef.current.all.loaded) void fetchBucket('all', { reset: false });
      void fetchStats();
      // REST 重取会通过 mergeRooms 覆盖 per-room unreadCountForAgent，
      // 但 totalUnread 仅由 socket 事件设置。重取完成后重新请求计数，
      // 确保「批量管理」旁的未读总数与 per-room 徽标一致。
      await new Promise((r) => setTimeout(r, 300));
      reqNotifCountsRef.current();
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
      // 初始加载 / 搜索后 REST 数据可能覆盖 socket 推送的 per-room 计数，
      // 重新请求以确保 totalUnread 与 per-room 一致。
      reqNotifCountsRef.current();
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
      // 检查房间是否存在于任一桶；若不存在则构建最小 ChatRoom 并加入「全部」+ 对应状态桶，
      // 解决新会话消息仅在切换到具体桶后才可见的问题（scheduleRefetchLive 有 600ms 延迟，
      // 且依赖 all.loaded 条件，首次到达的新房间可能漏掉）。
      setBuckets((prev) => {
        const next = { ...prev };
        const roomExists = (Object.keys(next) as BucketKey[]).some((k) =>
          next[k].rooms.some((r) => r.roomId === room.roomId),
        );

        if (!roomExists && room.roomId) {
          const status = (room.status ?? 'waiting') as ChatRoom['status'];
          const target: BucketKey =
            status === 'waiting' ? 'waiting' : status === 'active' ? 'active' : 'closed';
          const newRoom: ChatRoom = {
            roomId: room.roomId as string,
            clientEmail: (room as Partial<ChatRoom>).clientEmail ?? '',
            clientName: (room as Partial<ChatRoom>).clientName,
            status,
            assignedAgentEmail: room.assignedAgentEmail ?? undefined,
            lastActivity:
              (room.lastActivity as string) ?? message.timestamp ?? new Date().toISOString(),
            unreadCountForClient: room.unreadCountForClient ?? 0,
            unreadCountForAgent: isSelected ? 0 : (room.unreadCountForAgent ?? 1),
            lastMessage: {
              messageId: message.messageId,
              content: message.content,
              sender: message.sender,
              senderEmail: message.senderEmail,
              timestamp: message.timestamp ?? new Date().toISOString(),
              attachmentCount: message.attachments?.length ?? 0,
            },
            messages: [message],
          };
          // 加入「全部」桶（置顶，按时间排序会在 refetch 后修正）
          next.all = { ...next.all, rooms: [newRoom, ...next.all.rooms] };
          // 加入对应状态桶
          next[target] = { ...next[target], rooms: [newRoom, ...next[target].rooms] };
          return next;
        }

        // 房间已存在：追加消息到所有包含该房间的桶
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
      transferred?: boolean;
      transferredBy?: string;
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
      // 仅对「当前正在查看的会话」弹提示，避免无关会话误触发；
      // 房间名优先从 buckets 快照按 roomId 精确查找，避免取错 selectedRoom。
      const roomOfPayload =
        (isSelected && selectedRoomRef.current) ||
        Object.values(bucketsRef.current)
          .flatMap((b) => b.rooms)
          .find((r) => r.roomId === payload.roomId) ||
        null;
      const payloadName = roomOfPayload?.clientName || roomOfPayload?.clientEmail || '访客';
      // 访客重开已关闭会话：明确提示坐席，使其注意到「会话已重新打开、可继续回复」
      // （composer 已随 room.status 响应式恢复可输入，这里补一个显式信号）。
      if (payload.reopened && isSelected) {
        toast.info(`${payloadName} 已重新打开会话，可继续回复`);
      }
      // 会话被转接（由另一坐席发起，或自己转出）：提示接手方/转出方
      if (payload.transferred && isSelected) {
        toast.info(
          payload.transferredBy && payload.transferredBy !== agentEmail
            ? `「${payloadName}」的会话已转接给你`
            : `已将「${payloadName}」转接给 ${payload.assignedAgentEmail ?? '其他坐席'}`,
        );
      }
      scheduleRefetchLive();
      void fetchStats();
    },
    [moveRoomToBucket, scheduleRefetchLive, fetchStats, handleBucketChange, agentEmail],
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
                // 后端始终返回实际被标记的 messageIds（可能为空数组）。
                // 空数组表示本次无需新回执，不应回退到「标记全部」。
                const idSet = Array.isArray(messageIds)
                  ? new Set(messageIds)
                  : null;
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

  /** 在线坐席花名册（P1 H3 转接目标列表） */
  const handleAgentRoster = useCallback((payload: { agents: OnlineAgent[] }) => {
    setOnlineAgents(payload.agents ?? []);
  }, []);

  /** 访客正在输入（P1 H2）：在其当前选中会话里显示「访客正在输入…」 */
  const handleTyping = useCallback((payload: { roomId?: string; userType?: string }) => {
    if (payload.userType !== 'client' || payload.roomId !== selectedIdRef.current) return;
    setClientTyping(true);
    if (clientTypingTimer.current) clearTimeout(clientTypingTimer.current);
    clientTypingTimer.current = setTimeout(() => setClientTyping(false), 4000);
  }, []);

  const handleStopTyping = useCallback((payload: { roomId?: string; userType?: string }) => {
    if (payload.userType !== 'client' || payload.roomId !== selectedIdRef.current) return;
    setClientTyping(false);
    if (clientTypingTimer.current) clearTimeout(clientTypingTimer.current);
  }, []);

  /** 未读聚合计数（P2 M1）：总量驱动顶栏徽标；roomCounts 全量刷新各会话未读徽标 */
  const handleNotifCounts = useCallback(
    (
      payload: {
        totalUnread?: number;
        roomCounts?: Array<{ roomId: string; unreadCount: number }>;
      },
    ) => {
      setTotalUnread(typeof payload.totalUnread === 'number' ? payload.totalUnread : 0);
      if (payload.roomCounts) {
        const byRoom = new Map(payload.roomCounts.map((r) => [r.roomId, r.unreadCount]));
        setBuckets((prev) => {
          const next = { ...prev };
          (Object.keys(next) as BucketKey[]).forEach((k) => {
              next[k] = {
                ...next[k],
                rooms: next[k].rooms.map((r) => {
                  const count = byRoom.get(r.roomId);
                  // 服务端返回所有房间（含 0），不在响应中的房间也重置为 0
                  return count !== undefined
                    ? { ...r, unreadCountForAgent: count }
                    : r.unreadCountForAgent !== 0
                      ? { ...r, unreadCountForAgent: 0 }
                      : r;
                }),
              };
          });
          return next;
        });
      }
    },
    [],
  );

  /** 转接当前会话给某在线坐席（P1 H3） */
  const handleTransfer = useCallback(
    (toAgentEmail: string) => {
      const room = selectedRoomRef.current;
      if (!room) return;
      socket.transferRoom(room.roomId, toAgentEmail);
    },
    [socket],
  );

  /** 草稿变化：同步本地态 + 上报「正在输入」（P1 H2，网关已节流） */
  const handleDraftChange = useCallback(
    (value: string) => {
      setDraft(value);
      const rid = selectedIdRef.current;
      if (!rid) return;
      if (value.trim()) socket.sendTyping(rid);
      else socket.sendStopTyping(rid);
    },
    [socket],
  );

  useEffect(() => {
    socket.on('room-list-updated', handleRoomList);
    socket.on('new-message', handleNewMessage);
    socket.on('room-status-changed', handleStatusChanged);
    socket.on('messages-read', handleMessagesRead);
    socket.on('presence-changed', handlePresenceChanged);
    socket.on('user-left', handleUserLeft);
    socket.on('agent-roster', handleAgentRoster);
    socket.on('typing', handleTyping);
    socket.on('stop-typing', handleStopTyping);
    socket.on('notification-counts-updated', handleNotifCounts);
    socket.on('notification-counts', handleNotifCounts);
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
      socket.off('agent-roster');
      socket.off('typing');
      socket.off('stop-typing');
      socket.off('notification-counts-updated');
      socket.off('notification-counts');
      socket.off('error');
      if (clientTypingTimer.current) clearTimeout(clientTypingTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    handleRoomList,
    handleNewMessage,
    handleStatusChanged,
    handleMessagesRead,
    handlePresenceChanged,
    handleUserLeft,
    handleAgentRoster,
    handleTyping,
    handleStopTyping,
    handleNotifCounts,
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
      // 点开会话的瞬间，读取该会话当前的未读数，乐观地把「未读总数」即时扣减，
      // 避免后端 notification-counts 推送延迟/被覆盖时，左侧徽标在打开会话后仍停留在旧值。
      // 后端在收到 markRead 后会通过 notification-counts-updated 推送权威总数做二次校正，
      // 二者口径一致（坐席端 totalUnread 统计全部 active/waiting 会话，
      // 扣减仅针对本次打开的会话，不会误伤其它会话的真实未读）。
      let roomUnread = 0;
      const bucketsNow = bucketsRef.current;
      for (const k of Object.keys(bucketsNow) as BucketKey[]) {
        const found = bucketsNow[k].rooms.find((r) => r.roomId === roomId);
        if (found) {
          roomUnread = found.unreadCountForAgent ?? 0;
          break;
        }
      }
      if (roomUnread > 0) setTotalUnread((prev) => Math.max(0, prev - roomUnread));
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
        totalUnread={totalUnread}
      />
      {selectedRoom ? (
        <ChatArea
          key={selectedRoom.roomId}
          room={{ ...selectedRoom, messages: selectedRoom.messages ?? [] }}
          draft={draft}
          onDraftChange={handleDraftChange}
          onSend={handleSend}
          onClose={handleClose}
          quickReplies={QUICK_REPLIES}
          onQuickReply={handleQuickReply}
          onConverted={handleConverted}
          onlineAgents={onlineAgents}
          currentAgentEmail={agentEmail}
          onTransfer={handleTransfer}
          clientTyping={clientTyping}
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
