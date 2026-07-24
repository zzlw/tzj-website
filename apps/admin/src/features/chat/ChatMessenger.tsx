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
const MINE_QUERY_KEY = 'mine';
const PAGE_SIZE = 20;

const VALID_BUCKETS: BucketKey[] = ['all', 'waiting', 'active', 'closed', 'archived'];

/** 从 URL ?bucket= 读取初始分桶，非法/缺省回退到 all（全部） */
function readInitialBucket(search?: string | null): BucketKey {
  const v = new URLSearchParams(search ?? '').get(BUCKET_QUERY_KEY);
  return v && (VALID_BUCKETS as string[]).includes(v) ? (v as BucketKey) : 'all';
}

/** 各分桶对应的后端 status 过滤。
 * 业内最佳实践：归档是冷存终态，退出日常工作列表——
 * 「全部」桶 = 可操作范围（waiting/active/closed），「已关闭」桶仅含 closed，
 * 归档会话仅在独立的「已归档」桶中可达。 */
const BUCKET_STATUSES: Record<BucketKey, string> = {
  all: 'waiting,active,closed',
  waiting: 'waiting',
  active: 'active',
  closed: 'closed',
  archived: 'archived',
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
    // 「离线」冲回 undefined（UI 兖底成绿色=在线）。
    const presence = r.clientPresence ?? prev?.clientPresence;
    // 同理保留「面板打开」 engagement 信号（socket 推送的 clientPanelOpen）。
    const panelOpen = r.clientPanelOpen ?? prev?.clientPanelOpen;
    // 防闪烁：未读数取「本地 vs HTTP」较大者，避免 HTTP 重取的旧值把 socket 刚推送的新未读打回。
    // 坐席主动 markRead 后 socket 会将本地置 0，此时 HTTP 返回 0 也正确，不会误保留。
    const unread = Math.max(r.unreadCountForAgent ?? 0, prev?.unreadCountForAgent ?? 0);
    const messages =
      prev?.messages && prev.messages.length > 0 && (!r.messages || r.messages.length === 0)
        ? prev.messages
        : r.messages;
    const next: ChatRoom = {
      ...r,
      messages,
      clientPresence: presence,
      clientPanelOpen: panelOpen,
      unreadCountForAgent: unread,
    };
    // 防闪烁：合并结果与本地快照在渲染相关字段上无差异时，保留原对象引用——
    // 后台 refetch 不会触发行级重渲染（半透明背景 + backdrop-blur 下列表整体「闪一下」的根源）。
    if (
      prev &&
      prev.status === next.status &&
      prev.lastActivity === next.lastActivity &&
      prev.clientPresence === next.clientPresence &&
      prev.clientPanelOpen === next.clientPanelOpen &&
      prev.unreadCountForAgent === next.unreadCountForAgent &&
      prev.assignedAgentEmail === next.assignedAgentEmail &&
      prev.clientName === next.clientName &&
      prev.clientEmail === next.clientEmail &&
      prev.lastMessage?.messageId === next.lastMessage?.messageId &&
      prev.messages === next.messages
    ) {
      map.set(r.roomId, prev);
    } else {
      map.set(r.roomId, next);
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
    archived: emptyBucket(),
  });
  const [bucketCounts, setBucketCounts] = useState<Record<BucketKey, number>>({
    all: 0,
    waiting: 0,
    active: 0,
    closed: 0,
    archived: 0,
  });
  const [activeBucket, setActiveBucket] = useState<BucketKey>(() =>
    readInitialBucket(searchParams.toString()),
  );
  // 「仅我的」筛选状态，通过 URL ?mine=1 持久化，刷新后保持
  const [mineOnly, setMineOnly] = useState(() =>
    new URLSearchParams(searchParams.toString()).get(MINE_QUERY_KEY) === '1',
  );
  const handleMineOnlyChange = useCallback((v: boolean) => {
    setMineOnly(v);
    if (typeof window !== 'undefined') {
      const next = new URLSearchParams(window.location.search);
      if (v) next.set(MINE_QUERY_KEY, '1');
      else next.delete(MINE_QUERY_KEY);
      window.history.replaceState(null, '', `?${next.toString()}`);
    }
  }, []);
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
  // 搜索结果跳转：打开会话时需滚动定位并高亮的目标消息 id（无则常规滑到底）
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState('');
  // 在线坐席花名册（P1 H3 转接目标）
  const [onlineAgents, setOnlineAgents] = useState<OnlineAgent[]>([]);
  // 当前访客是否正在输入（P1 H2）
  const [clientTyping, setClientTyping] = useState(false);
  // 访客实时输入内容预览（业内最佳实践 LiveChat/Tawk.to）
  const [clientTypingText, setClientTypingText] = useState('');
  // 未读聚合总数（P2 M1）
  const [totalUnread, setTotalUnread] = useState(0);
  // 徽标展示值（非对称防抖）：多坐席场景下，他坐席 markRead 某会话时，服务端会先广播
  // 「未读」中间态、再广播「已清零」修正态（readReceipts 按 userType 键控，一人已读=全员已读），
  // 本坐席徽标会闪现瞬态「1」。增加延迟确认（瞬态上跳被随后的回落吞掉，不展示），
  // 减少立即生效（坐席已读会话时徽标响应不延迟）。
  const [displayedTotalUnread, setDisplayedTotalUnread] = useState(0);
  const displayedTotalUnreadRef = useRef(0);
  useEffect(() => {
    if (totalUnread <= displayedTotalUnreadRef.current) {
      displayedTotalUnreadRef.current = totalUnread;
      setDisplayedTotalUnread(totalUnread);
      return;
    }
    const t = setTimeout(() => {
      displayedTotalUnreadRef.current = totalUnread;
      setDisplayedTotalUnread(totalUnread);
    }, 500);
    return () => clearTimeout(t);
  }, [totalUnread]);
  const clientTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 防闪烁：记录最近由 new-message 事件本地递增了未读数的房间及时间戳，
  // 在短窗口内忽略 notification-counts 对该房间的覆写（避免旧查询结果把刚递增的徽标打回 0）。
  const recentUnreadBumpRef = useRef<Map<string, number>>(new Map());

  const { socket } = useChatPresence();
  // requestNotificationCounts 稳定引用，避免 socket 对象每次渲染新引用导致依赖数组重新执行
  const reqNotifCountsRef = useRef(socket.requestNotificationCounts);
  reqNotifCountsRef.current = socket.requestNotificationCounts;
  // requestRoomList 稳定引用（同理）
  const reqRoomListRef = useRef(socket.requestRoomList);
  reqRoomListRef.current = socket.requestRoomList;

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
        newStatus === 'waiting'
          ? 'waiting'
          : newStatus === 'active'
            ? 'active'
            : newStatus === 'archived'
              ? 'archived'
              : 'closed';
      // 「全部」桶 = 可操作范围（waiting/active/closed），不含归档冷存：
      // 房间归档时应从「全部」移除，其它状态迁移则在「全部」中同步状态。
      const keepInAll = target !== 'archived';
      setBuckets((prev) => {
        const next = { ...prev };
        let moved: ChatRoom | undefined;
        // 从其它具体状态桶（非 target）中移除该房间；
        // 归档时一并从「全部」桶移除（all 不含归档）。
        (Object.keys(next) as BucketKey[]).forEach((k) => {
          if (k === target) return;
          if (k === 'all' && keepInAll) return;
          const room = next[k].rooms.find((r) => r.roomId === roomId);
          if (room) {
            moved = room;
            next[k] = {
              ...next[k],
              rooms: next[k].rooms.filter((r) => r.roomId !== roomId),
            };
          }
        });
        // 非归档迁移：同步「全部」桶中该房间的状态字段（状态变化后在全部列表里也应反映）
        if (keepInAll && next.all.rooms.some((r) => r.roomId === roomId)) {
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
      const closed = stats.statusBreakdown.closed ?? 0;
      const archived = stats.statusBreakdown.archived ?? 0;
      setBucketCounts({
        // 「全部」= 可操作范围，不含归档冷存
        all: waiting + active + closed,
        waiting,
        active,
        closed,
        archived,
      });
    } catch {
      /* 忽略 */
    }
  }, []);

  const fetchBucket = useCallback(async (bucket: BucketKey, opts?: { reset?: boolean; background?: boolean }) => {
    const reset = opts?.reset ?? true;
    const background = opts?.background ?? false;
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
        // 后台刷新始终从第一页拉取（刷新已有数据 + 捕获新会话），
        // 不使用当前 cursor（否则会「偷跑」下一页，改变分页状态）。
        // 用户点击「加载更多」时才用 cursor 拉取下一页。
        cursor: reset || background ? undefined : (cur.cursor ?? undefined),
        take: PAGE_SIZE,
      });
      setBuckets((prev) => {
        const target = prev[bucket];
        // HTTP 列表不含实时 clientPresence（presence 仅存于网关内存，由 socket
        // presence-changed 事件维护）。重取时保留已知的在线状态，避免把 socket
        // 刚推送的「离线」冲回 undefined（UI 兜底成绿色=在线），表现为
        // 「关页后离线 1 秒又变在线」。
        const knownPresence = new Map<string, PresenceStatus>();
        const knownPanel = new Map<string, boolean>();
        (Object.keys(prev) as BucketKey[]).forEach((k) => {
          for (const r of prev[k].rooms) {
            if (r.clientPresence) knownPresence.set(r.roomId, r.clientPresence);
            if (r.clientPanelOpen) knownPanel.set(r.roomId, r.clientPanelOpen);
          }
        });
        const enriched = data.rooms.map((r) =>
          r.clientPresence
            ? r
            : {
                ...r,
                clientPresence: knownPresence.get(r.roomId),
                clientPanelOpen: knownPanel.get(r.roomId),
              },
        );
        const merged = reset ? enriched : mergeRooms(target.rooms, enriched);
        // 分页状态更新策略：
        // - reset（初始加载/搜索）：直接用响应值
        // - background（后台刷新）：不改变 cursor 和 hasMore，避免按钮偶发消失/闪现
        // - 用户点击「加载更多」：用响应值推进分页
        const nextCursor = reset ? data.nextCursor : background ? cur.cursor : data.nextCursor;
        const nextHasMore = reset
          ? data.nextCursor != null
          : background
            ? cur.hasMore || data.nextCursor != null
            : data.nextCursor != null;
        return {
          ...prev,
          [bucket]: {
            ...target,
            rooms: merged,
            cursor: nextCursor,
            hasMore: nextHasMore,
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
      // background: true → 从第一页拉取刷新已有数据，不改变分页状态（cursor/hasMore），
      // 避免「加载更多」按钮因后台刷新而偶发消失。
      void fetchBucket('waiting', { reset: false, background: true });
      void fetchBucket('active', { reset: false, background: true });
      if (bucketsRef.current.closed.loaded) void fetchBucket('closed', { reset: false, background: true });
      if (bucketsRef.current.archived.loaded) void fetchBucket('archived', { reset: false, background: true });
      if (bucketsRef.current.all.loaded) void fetchBucket('all', { reset: false, background: true });
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
      // 通过 socket（已鉴权）请求会话列表，解决切换菜单返回时 HTTP API 无 auth 导致列表为空的问题
      reqRoomListRef.current();
      await Promise.all([
        fetchBucket('all'),
        fetchBucket('waiting'),
        fetchBucket('active'),
        fetchBucket('closed'),
        fetchBucket('archived'),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, fetchBucket, fetchStats]);

  /* ── 切换分桶：未加载过则补拉 ── */
  useEffect(() => {
    if (!buckets[activeBucket].loaded) void fetchBucket(activeBucket);
    // 仅在选择变化时触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBucket]);

  /* ── Socket 实时事件 ── */
  const handleRoomList = useCallback(
    (payload?: {
      rooms?: ChatRoom[];
      statusBreakdown?: { active: number; waiting: number; closed: number; archived: number };
    }) => {
      // 网关 broadcastRoomListUpdate / register-agent 推送的 rooms 已用内存
      // presence 注入 clientPresence（enrichRoomsWithPresence）。
      // 这里：1) 把 socket 携带的实时 clientPresence 应用到本地已有会话；
      //      2) 直接把「本地尚未存在的新会话」插入列表，避免「开始新对话后发首条
      //         消息，B 端列表不立即更新」——scheduleRefetchLive 走 HTTP 重取时
      //         用 reset:false 会带上翻页 cursor 只拉下一页，而新会话排在第一页
      //         顶部，导致被漏掉，只能等刷新/切桶整桶重拉才出现。
      //      3) 从 payload.statusBreakdown 同步 Tab 计数（不再依赖独立 HTTP API，
      //         解决切换菜单后 HTTP 鉴权丢失导致计数为 0 的问题）。
      if (payload?.statusBreakdown) {
        const { waiting, active, closed, archived } = payload.statusBreakdown;
        setBucketCounts({ all: waiting + active + closed, waiting, active, closed, archived });
      }
      let hasNewRooms = false;
      if (payload?.rooms?.length) {
        const incoming = payload.rooms;
        const presenceById = new Map<string, PresenceStatus>();
        const panelById = new Map<string, boolean>();
        for (const r of incoming) {
          if (r.clientPresence) presenceById.set(r.roomId, r.clientPresence);
          // 注意：必须按 boolean 收集（含 false）。room-list-updated 是完整快照，
          // 访客关闭聊天窗口后 clientPanelOpen=false 需要能覆盖旧的 true；若用
          // `if (r.clientPanelOpen)` 过滤，false 会被丢弃，导致 B 端残留「正在查看对话」。
          if (typeof r.clientPanelOpen === 'boolean') panelById.set(r.roomId, r.clientPanelOpen);
        }
        setBuckets((prev) => {
          const next = { ...prev };
          // 1) 把 socket 携带的实时 presence / 面板打开状态应用到已有会话
          //    （无变化时保留原对象引用，避免每次广播触发全量行重渲染）
          if (presenceById.size || panelById.size) {
            (Object.keys(next) as BucketKey[]).forEach((k) => {
              next[k] = {
                ...next[k],
                rooms: next[k].rooms.map((r) => {
                  const cp = presenceById.has(r.roomId)
                    ? presenceById.get(r.roomId)!
                    : r.clientPresence;
                  const po = panelById.has(r.roomId)
                    ? panelById.get(r.roomId)!
                    : r.clientPanelOpen;
                  return cp === r.clientPresence && po === r.clientPanelOpen
                    ? r
                    : { ...r, clientPresence: cp, clientPanelOpen: po };
                }),
              };
            });
          }
          // 2) 直接插入本地尚未存在的新会话（payload 已按时间倒序）
          const newRooms: ChatRoom[] = [];
          for (const room of incoming) {
            const exists = (Object.keys(next) as BucketKey[]).some((k) =>
              next[k].rooms.some((r) => r.roomId === room.roomId),
            );
            if (!exists) newRooms.push(room);
          }
          if (newRooms.length) {
            hasNewRooms = true;
            for (const room of newRooms) {
              const status = (room.status ?? 'waiting') as ChatRoom['status'];
              const target: BucketKey =
                status === 'waiting'
                  ? 'waiting'
                  : status === 'active'
                    ? 'active'
                    : status === 'archived'
                      ? 'archived'
                      : 'closed';
              // 「全部」桶 = 可操作范围（waiting/active/closed），归档冷存不入 all
              if (target !== 'archived') {
                next.all = { ...next.all, rooms: [room, ...next.all.rooms] };
              }
              next[target] = {
                ...next[target],
                rooms: [room, ...next[target].rooms],
              };
            }
          }
          return next;
        });
      }
      // 仅当有真正的新会话插入时才触发 HTTP 重取，纯 presence/panelOpen 更新不 refetch，
      // 避免访客每次开关聊天面板都触发全量重取导致 hasMore/cursor 拖动（「加载更多」闪现）。
      if (hasNewRooms) {
        scheduleRefetchLive();
      }
    },
    [scheduleRefetchLive],
  );

  const handleNewMessage = useCallback(
    (payload: { message: ChatMessage; room: Partial<ChatRoom> }) => {
      const { message, room } = payload;
      const isSelected = room.roomId === selectedIdRef.current;
      // 防闪烁：记录本地递增未读数的时间戳，供 handleNotifCounts 在短窗口内不覆写
      if (!isSelected && (room.unreadCountForAgent ?? 0) > 0) {
        recentUnreadBumpRef.current.set(room.roomId as string, Date.now());
      }
      patchRoom(room.roomId as string, {
        lastActivity: (room.lastActivity as string) ?? undefined,
        status: room.status as ChatRoom['status'],
        // 立即更新最后一条消息预览：不等 600ms 后的 HTTP refetch，
        // 列表行预览文本与 byRecency 排序键同步即时生效（防闪烁前置条件）。
        lastMessage: {
          messageId: message.messageId,
          content: message.content,
          sender: message.sender,
          senderEmail: message.senderEmail,
          timestamp: message.timestamp ?? new Date().toISOString(),
          attachmentCount: message.attachments?.length ?? 0,
        },
        // 正在查看的会话不计未读：后端 unaware agent 是否聚焦该会话，会正常累加，
        // 这里强制归零，避免列表徽标在当前会话上闪烁。
        unreadCountForAgent: isSelected ? 0 : (room.unreadCountForAgent ?? 0),
        unreadCountForClient: room.unreadCountForClient ?? 0,
        assignedAgentEmail: room.assignedAgentEmail ?? undefined,
      });
      // 当前会话收到对方新消息 → 立即上报已读 + 清除 typing 预览
      // （总数徽标的防闪烁由 handleNotifCounts 统一处理：从服务端总数中扣除选中房间计数）
      if (isSelected && message.sender !== 'agent') {
        socket.markRead(room.roomId as string);
        setClientTyping(false);
        setClientTypingText('');
        if (clientTypingTimer.current) clearTimeout(clientTypingTimer.current);
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
            status === 'waiting'
              ? 'waiting'
              : status === 'active'
                ? 'active'
                : status === 'archived'
                  ? 'archived'
                  : 'closed';
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
          // 加入「全部」桶（置顶，按时间排序会在 refetch 后修正）；
          // 归档冷存不入 all（防御性：服务端已拒绝对归档会话发消息，此分支理论上不触发）
          if (target !== 'archived') {
            next.all = { ...next.all, rooms: [newRoom, ...next.all.rooms] };
          }
          // 加入对应状态桶
          next[target] = { ...next[target], rooms: [newRoom, ...next[target].rooms] };
          return next;
        }

        // 房间已存在：追加消息到所有包含该房间的桶，并即时重排序——
        // 收到消息的会话立即置顶（WhatsApp/WeChat 式自然行为），避免 600ms 后
        // refetch 的 mergeRooms 重排导致全列表行内容一次性换位（「闪一下」）。
        (Object.keys(next) as BucketKey[]).forEach((k) => {
          next[k] = {
            ...next[k],
            rooms: next[k].rooms
              .map((r) => {
                if (r.roomId !== room.roomId) return r;
                const has = (r.messages ?? []).some((m) => m.messageId === message.messageId);
                return {
                  ...r,
                  messages: has ? (r.messages ?? []) : [...(r.messages ?? []), message],
                };
              })
              .sort(byRecency),
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
        // 负责人变更时清空旧账号卡片，避免 hover 显示前任负责人；
        // 新负责人信息随下一次 HTTP refetch（broadcastRoomListUpdate 触发）填充。
        ...(payload.assignedAgentEmail ? { assignedAgentUser: null } : {}),
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
      // 会话被转接/接管（区分三种情形，避免「转给自己」时提示语义错乱）：
      //  - 我发起 + 我成为新负责人 → 接管；他人发起 + 我成为负责人 → 转给我；否则 → 我转给他人。
      if (payload.transferred && isSelected) {
        const iAmNewOwner = payload.assignedAgentEmail === agentEmail;
        const iInitiated = payload.transferredBy === agentEmail;
        toast.info(
          iInitiated && iAmNewOwner
            ? `你已接管「${payloadName}」的会话`
            : iAmNewOwner
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
      /** 访客聊天面板开关（独立 engagement 信号，不影响在线态） */
      chatPanelOpen?: boolean;
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
                return {
                  ...r,
                  clientPresence: payload.status,
                  clientPanelOpen:
                    typeof payload.chatPanelOpen === 'boolean'
                      ? payload.chatPanelOpen
                      : r.clientPanelOpen,
                };
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

  // `user-left` 表示访客「离开了某个会话」（点「开始新会话」leave-room / 真正断开该房间）。
  // 访客可能仍全局在线（开启了新匿名会话），但「离开该会话」即意味着此会话的访客已离线，
  // 故仅将该房间置为 offline，不影响其在其它会话的在线状态。
  // 这与网关 enrichRoomsWithPresence（按房间成员关系判定在线态）保持一致：刷新 / B 端广播后同样离线。
  const handleUserLeft = useCallback(
    (payload: { roomId?: string; userEmail?: string }) => {
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
    },
    [],
  );

  /** 在线坐席花名册（P1 H3 转接目标列表） */
  const handleAgentRoster = useCallback((payload: { agents: OnlineAgent[] }) => {
    setOnlineAgents(payload.agents ?? []);
  }, []);

  /** 访客正在输入（P1 H2）：显示「访客正在输入…」+ 实时输入内容预览
      超时 30s 纯为安全兖底（访客关闭页面/网络断开），正常流程由 stop-typing / new-message 清除 */
  const handleTyping = useCallback((payload: { roomId?: string; userType?: string; text?: string }) => {
    if (payload.userType !== 'client' || payload.roomId !== selectedIdRef.current) return;
    setClientTyping(true);
    setClientTypingText(payload.text ?? '');
    if (clientTypingTimer.current) clearTimeout(clientTypingTimer.current);
    clientTypingTimer.current = setTimeout(() => {
      setClientTyping(false);
      setClientTypingText('');
    }, 30000);
  }, []);

  const handleStopTyping = useCallback((payload: { roomId?: string; userType?: string }) => {
    if (payload.userType !== 'client' || payload.roomId !== selectedIdRef.current) return;
    setClientTyping(false);
    setClientTypingText('');
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
      let total = typeof payload.totalUnread === 'number' ? payload.totalUnread : 0;
      // 防闪烁（不依赖事件时序）：选中会话永远被立即 markRead，其对未读总数的
      // 真实贡献恒为 0；但服务端广播的 DB 查询可能先于 markRead 落库，仍计入该会话。
      // 直接从总数中减去 payload 里选中房间的计数，避免徽标 N→N+1→N 闪烁。
      const selectedNow = selectedIdRef.current;
      if (selectedNow && payload.roomCounts) {
        const selectedCount = payload.roomCounts.find(
          (rc) => rc.roomId === selectedNow,
        )?.unreadCount;
        if (selectedCount) total = Math.max(0, total - selectedCount);
      }
      setTotalUnread(total);
      if (payload.roomCounts) {
        const byRoom = new Map(payload.roomCounts.map((r) => [r.roomId, r.unreadCount]));
        const now = Date.now();
        setBuckets((prev) => {
          const next = { ...prev };
          let changed = false;
          (Object.keys(next) as BucketKey[]).forEach((k) => {
              const updatedRooms = next[k].rooms.map((r) => {
                  // 选中会话始终以本地 markRead 后的 0 为准：服务端计数可能先于
                  // markRead 落库（过期值 1），若覆写会导致行徽标闪现「1」后消失。
                  if (r.roomId === selectedNow) return r;
                  const count = byRoom.get(r.roomId);
                  if (count === undefined) {
                    if (r.unreadCountForAgent !== 0) {
                      changed = true;
                      return { ...r, unreadCountForAgent: 0 };
                    }
                    return r;
                  }
                  // 防闪烁：若该房间在 2s 内刚被 new-message 本地递增过未读数，
                  // 且服务端推送的值比本地小（说明查询发生在消息写入之前），
                  // 则保留本地较大的值，避免徽标「1→0→1」闪烁。
                  const bumpedAt = recentUnreadBumpRef.current.get(r.roomId);
                  if (
                    bumpedAt &&
                    now - bumpedAt < 2000 &&
                    count < (r.unreadCountForAgent ?? 0)
                  ) {
                    return r;
                  }
                  // 窗口过期则清理
                  if (bumpedAt && now - bumpedAt >= 2000) {
                    recentUnreadBumpRef.current.delete(r.roomId);
                  }
                  if (count !== (r.unreadCountForAgent ?? 0)) {
                    changed = true;
                    return { ...r, unreadCountForAgent: count };
                  }
                  return r;
                });
              next[k] = { ...next[k], rooms: updatedRooms };
          });
          // 无任何房间变化时返回原引用，避免周期性重取计数触发全列表无意义重渲染
          return changed ? next : prev;
        });
      }
    },
    [],
  );

  /** 转接当前会话给某在线坐席（P1 H3） */
  const handleTransfer = useCallback(
    (toAgentEmail: string, note?: string) => {
      const room = selectedRoomRef.current;
      if (!room) return;
      socket.transferRoom(room.roomId, toAgentEmail, note);
    },
    [socket],
  );

  /** 收到转接通知（目标坐席收到）：弹 toast + 刷新列表 + 直接使用携带的历史消息 */
  const handleTransferredIn = useCallback(
    (payload: {
      roomId: string;
      clientEmail: string;
      clientName?: string;
      transferredBy: string;
      note?: string | null;
      status?: string;
      assignedAgentEmail?: string;
      messages?: ChatMessage[];
    }) => {
      const name = payload.clientName || payload.clientEmail;
      toast.info(
        payload.note
          ? `${payload.transferredBy} 转接了「${name}」的会话给你（备注：${payload.note}）`
          : `${payload.transferredBy} 转接了「${name}」的会话给你`,
      );
      scheduleRefetchLive();
      // 业内最佳实践：转接时后端已携带完整历史消息，无需额外 HTTP 请求
      const incomingMessages = payload.messages ?? [];
      setBuckets((prev) => {
        const next = { ...prev };
        // 检查房间是否已存在于任一桶
        const roomExists = (Object.keys(next) as BucketKey[]).some((k) =>
          next[k].rooms.some((r) => r.roomId === payload.roomId),
        );

        if (roomExists) {
          // 房间已存在：合并消息
          (Object.keys(next) as BucketKey[]).forEach((k) => {
            next[k] = {
              ...next[k],
              rooms: next[k].rooms.map((r) => {
                if (r.roomId !== payload.roomId) return r;
                const map = new Map<string, ChatMessage>();
                for (const m of r.messages ?? []) map.set(m.messageId, m);
                for (const m of incomingMessages) map.set(m.messageId, m);
                const merged = Array.from(map.values()).sort(
                  (a, b) =>
                    new Date(a.timestamp).getTime() -
                    new Date(b.timestamp).getTime(),
                );
                return {
                  ...r,
                  messages: merged,
                  status: (payload.status as ChatRoom['status']) ?? r.status,
                  assignedAgentEmail: payload.assignedAgentEmail ?? r.assignedAgentEmail,
                  // 负责人变更时清空旧账号卡片（同 handleStatusChanged）
                  ...(payload.assignedAgentEmail ? { assignedAgentUser: null } : {}),
                };
              }),
            };
          });
        } else {
          // 房间不存在：构建新 ChatRoom 并加入桶（转接场景下目标坐席列表尚无此会话）
          const status = (payload.status ?? 'active') as ChatRoom['status'];
          const target: BucketKey =
            status === 'waiting'
              ? 'waiting'
              : status === 'active'
                ? 'active'
                : status === 'archived'
                  ? 'archived'
                  : 'closed';
          const lastMsg = incomingMessages.length > 0
            ? incomingMessages[incomingMessages.length - 1]
            : undefined;
          const newRoom: ChatRoom = {
            roomId: payload.roomId,
            clientEmail: payload.clientEmail,
            clientName: payload.clientName,
            status,
            assignedAgentEmail: payload.assignedAgentEmail,
            lastActivity: lastMsg?.timestamp ?? new Date().toISOString(),
            unreadCountForClient: 0,
            unreadCountForAgent: 0,
            messages: incomingMessages,
            lastMessage: lastMsg
              ? {
                  messageId: lastMsg.messageId,
                  content: lastMsg.content,
                  sender: lastMsg.sender,
                  senderEmail: lastMsg.senderEmail,
                  timestamp: lastMsg.timestamp,
                  attachmentCount: lastMsg.attachments?.length ?? 0,
                }
              : null,
          };
          // 归档冷存不入 all（防御性：转接不会发生在归档会话上）
          if (target !== 'archived') {
            next.all = { ...next.all, rooms: [newRoom, ...next.all.rooms] };
          }
          next[target] = { ...next[target], rooms: [newRoom, ...next[target].rooms] };
        }
        return next;
      });
    },
    [scheduleRefetchLive],
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
    socket.on('room-transferred-in', handleTransferredIn);
    socket.on('error', (payload: unknown) => {
      if (!initialLoaded.current) setLoading(false);
      // 兜底反馈：如向他人负责的会话发消息被服务端拒绝（NOT_ASSIGNEE），给出明确提示，
      // 而非静默失败（UI 通常已禁用输入，此处覆盖陈旧 UI / 竞态触发的场景）。
      const msg =
        payload && typeof payload === 'object' && 'message' in payload
          ? (payload as { message?: string }).message
          : undefined;
      if (msg) toast.warning(msg);
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
      socket.off('room-transferred-in');
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
    handleTransferredIn,
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

  // 重连恢复：socket 每次（重新）连接后，重新加入当前选中的房间。
  // Socket.IO 重连后房间成员资格丢失；服务端 joinAgentToActiveRooms 是异步且可能失败，
  // 客户端显式 re-join 确保当前会话的 new-message 事件不会因重连而永久丢失。
  const prevConnectedRef = useRef(false);
  useEffect(() => {
    const isConnected = socket.connected;
    if (isConnected && !prevConnectedRef.current) {
      // 刚重连（或首次连接）
      const roomId = selectedIdRef.current;
      if (roomId) {
        socket.joinRoom(roomId);
        // 补拉断线期间可能错过的消息（与 handleSelect 相同的合并逻辑）
        getChatRoom(roomId)
          .then((room) => {
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
                        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
                    );
                    return { ...r, messages: merged };
                  }),
                };
              });
              return next;
            });
          })
          .catch(() => {});
      }
    }
    prevConnectedRef.current = isConnected;
  }, [socket.connected, socket.joinRoom]);

  // 安全网（push+pull 双模型）：定时 HTTP 同步选中会话的消息。
  // socket 推送保证实时性，HTTP 拉取保证正确性——任何原因丢失的 new-message
  // 事件（重连窗口、传输层异常、服务端竞态）都会在 5s 内被自愈。
  // 熔断器：连续 3 次鉴权失败（401）后停止轮询，避免过期标签页/会话无限发送
  // 无效请求（此前过期标签页的无限 401 轮询会触发后端复用检测撤销全部会话）。
  useEffect(() => {
    if (!selectedId) return;
    const roomId = selectedId;
    let consecutiveAuthFailures = 0;
    const MAX_AUTH_FAILURES = 3;
    let stopped = false;

    const syncMessages = () => {
      if (stopped) return;
      getChatRoom(roomId)
        .then((room) => {
          consecutiveAuthFailures = 0; // 成功则重置计数
          setBuckets((prev) => {
            // 快路径：消息数量未变 → 无需更新，避免无谓重渲染
            const current = (Object.keys(prev) as BucketKey[])
              .map((k) => prev[k].rooms.find((r) => r.roomId === roomId))
              .find(Boolean);
            if (
              current?.messages &&
              room.messages &&
              current.messages.length >= room.messages.length
            ) {
              return prev;
            }
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
                      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
                  );
                  return { ...r, messages: merged, lastMessage: room.lastMessage ?? r.lastMessage };
                }),
              };
            });
            return next;
          });
        })
        .catch((err: unknown) => {
          // 检测鉴权失败（401）：熔断，避免过期会话无限轮询
          const msg = err instanceof Error ? err.message : '';
          if (msg.includes('401')) {
            consecutiveAuthFailures += 1;
            if (consecutiveAuthFailures >= MAX_AUTH_FAILURES) {
              stopped = true;
            }
          }
        });
    };
    const timer = setInterval(syncMessages, 5000);
    // 切回前台时立即同步一次（后台期间 socket 事件可能被浏览器节流）
    const onVisibility = () => {
      if (!document.hidden) syncMessages();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [selectedId]);

  const handleSelect = useCallback(
    async (roomId: string, messageId?: string) => {
      setSelectedId(roomId);
      // 仅当从搜索命中片段点入时携带 messageId；常规点击清空，避免残留高亮目标
      setHighlightMessageId(messageId ?? null);
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
      if (roomUnread > 0) {
        setTotalUnread((prev) => Math.max(0, prev - roomUnread));
      }
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
                  // 负责人账号卡片：详情接口返回最新值（可能被 socket patch 清空过）
                  assignedAgentUser: room.assignedAgentUser ?? r.assignedAgentUser,
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
                  // 同样保留面板打开 engagement 信号
                  clientPanelOpen: room.clientPanelOpen ?? r.clientPanelOpen,
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
      // 归档仅适用于已关闭会话（业内最佳实践：解决是归档的前置条件，
      // Zendesk/Intercom/Freshchat 均禁止跳过关闭直接归档）。
      // 客户端预过滤 + 即时提示，服务端 where 守卫作双保险。
      if (action === 'archive') {
        const allRooms = Object.values(bucketsRef.current).flatMap((b) => b.rooms);
        const notClosed = targets.filter((id) => {
          const r = allRooms.find((x) => x.roomId === id);
          return r && r.status !== 'closed' && r.status !== 'archived';
        });
        if (notClosed.length > 0) {
          targets = targets.filter((id) => !notClosed.includes(id));
          toast.warning(`${notClosed.length} 个未关闭会话已跳过：仅已关闭的会话可归档`);
        }
      }
      if (targets.length === 0) {
        setSelectedRoomIds(new Set());
        setSelectMode(false);
        return;
      }

      try {
        const result = await batchChatRooms(action, targets);
        // 业内最佳实践：批量操作必须有明确结果反馈（Intercom/Zendesk）
        const labels: Record<BatchChatRoomAction, string> = {
          close: '已关闭',
          archive: '已归档',
          delete: '已删除',
        };
        toast.success(`${result.count} 个会话${labels[action]}`);
        // 当前打开的会话被批量关闭 → 立即同步本地状态，
        // ChatArea 零延迟进入关闭态（服务端 socket 广播随后到达作为双保险）
        if (action === 'close') {
          const openId = selectedIdRef.current;
          if (openId && targets.includes(openId)) {
            patchRoom(openId, { status: 'closed' });
          }
        }
      } catch {
        toast.error('批量操作失败，请重试');
        return; // 失败时保留勾选状态，方便用户直接重试
      }
      setSelectedRoomIds(new Set());
      setSelectMode(false);
      await Promise.all([
        fetchBucket('all'),
        fetchBucket('waiting'),
        fetchBucket('active'),
        fetchBucket('closed'),
        fetchBucket('archived'),
        fetchStats(),
      ]);
    },
    [selectedRoomIds, fetchBucket, fetchStats, patchRoom],
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
    <div className="border-border/50 relative grid min-h-0 flex-1 w-full grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-3 overflow-hidden rounded-2xl border p-3 sm:gap-4 sm:p-4 lg:grid-rows-[1fr] lg:[grid-template-columns:minmax(280px,30%)_1fr] lg:gap-4 lg:rounded-3xl lg:p-5">
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
        totalUnread={displayedTotalUnread}
        currentAgentEmail={agentEmail}
        mineOnly={mineOnly}
        onMineOnlyChange={handleMineOnlyChange}
        canDelete={session.permissions.includes('chat.delete') || session.permissions.includes('*')}
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
          clientTypingText={clientTypingText}
          highlightMessageId={highlightMessageId}
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
