'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { API_BASE } from '@/lib/config';
import type { ChatMessage, ChatRoom, PresenceStatus } from './types';

// 聊天 Socket.IO 地址：默认取主 API 的 origin（复用已注入的 NEXT_PUBLIC_ADMIN_API_URL），
// 独立部署时可用 NEXT_PUBLIC_CHAT_SOCKET_URL 覆盖。切勿写死 localhost：那会在构建
// 时烤进镜像导致生产环境连到 ws://localhost:4000。
const SOCKET_URL = (process.env.NEXT_PUBLIC_CHAT_SOCKET_URL ?? new URL(API_BASE).origin).replace(
  /\/$/,
  '',
);

/** 在线坐席（供转接选择，P1 H3） */
export interface OnlineAgent {
  email: string;
  status: PresenceStatus;
  /** 坐席显示名（nickname / username，业内最佳实践：转接列表显示姓名而非 email） */
  name?: string | null;
  /** 当前活跃会话数（工作量指示，辅助转接决策） */
  activeRoomCount?: number;
}

/** 通知计数聚合负载（P2 M1 + 未读拆桶 §4.1.1：agent 分支携带三桶字段）；导出供通知弹层复用 roomCounts 元素类型 */
export interface AgentNotificationCounts {
  totalUnread: number;
  myUnread?: number;
  unassignedUnread?: number;
  othersUnread?: number;
  roomCounts?: Array<{
    roomId: string;
    unreadCount: number;
    clientEmail: string;
    status: string;
    assignedAgentEmail?: string | null;
  }>;
}

/** 坐席端（/chat 命名空间）事件契约：事件名 → 负载类型，供 on/off 强类型分发 */
type ChatAgentEventMap = {
  'room-list-updated': { rooms?: ChatRoom[] };
  'new-message': { message: ChatMessage; room: Partial<ChatRoom> };
  'room-status-changed': {
    roomId: string;
    status: string;
    assignedAgentEmail?: string;
    reopened?: boolean;
    transferred?: boolean;
    transferredBy?: string;
  };
  'messages-read': {
    roomId: string;
    userType: 'client' | 'agent';
    userEmail?: string;
    messageIds?: string[];
    room: Partial<ChatRoom>;
  };
  'presence-changed': {
    userEmail: string;
    userType: 'client' | 'agent';
    status: 'online' | 'away' | 'offline';
    roomId?: string;
  };
  /** 在线坐席花名册（P1 H3 转接目标） */
  'agent-roster': { agents: OnlineAgent[] };
  /** 访客正在输入（P1 H2）：含实时输入内容预览 */
  typing: { roomId?: string; userEmail?: string; userType?: string; text?: string };
  /** 访客停止输入（P1 H2） */
  'stop-typing': { roomId?: string; userEmail?: string; userType?: string };
  /** 通知计数聚合（P2 M1）：初始拉取 + 增量更新，形状一致 */
  'notification-counts': AgentNotificationCounts;
  'notification-counts-updated': AgentNotificationCounts;
  'user-left': { roomId?: string; userEmail?: string };
  /** 转接通知（目标坐席收到）：会话被转接给你，含备注、访客信息和历史消息 */
  'room-transferred-in': {
    roomId: string;
    clientEmail: string;
    clientName?: string;
    transferredBy: string;
    note?: string | null;
    status: string;
    assignedAgentEmail?: string;
    messages?: ChatMessage[];
  };
  error: unknown;
  'auth-error': unknown;
  'my-presence': { status: PresenceStatus };
};

export interface UseChatSocketResult {
  connected: boolean;
  /** 注册一次性/持续性事件监听 → 返回 unsubscribe 函数 */
  on: <K extends keyof ChatAgentEventMap>(
    event: K,
    cb: (payload: ChatAgentEventMap[K]) => void,
  ) => () => void; // unsubscribe
  /** 移除事件监听器；cb 可选（默认全清） */
  off: <K extends keyof ChatAgentEventMap>(
    event: K,
    cb?: (payload: ChatAgentEventMap[K]) => void,
  ) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendMessage: (roomId: string, content: string, attachments?: string[]) => void;
  markRead: (roomId: string) => void;
  updateStatus: (roomId: string, status: string, assignedAgentEmail?: string) => void;
  /** 转接会话给另一名坐席（P1 H3） */
  transferRoom: (roomId: string, toAgentEmail: string, note?: string) => void;
  /** 标记「正在输入」（P1 H2） */
  sendTyping: (roomId: string) => void;
  /** 标记「停止输入」（P1 H2） */
  sendStopTyping: (roomId: string) => void;
  /** 主动拉取未读聚合计数（P2 M1） */
  requestNotificationCounts: () => void;
  /** 主动请求会话列表（切换菜单返回聊天页时，socket 已连接但需重新拉取） */
  requestRoomList: () => void;
  /** 切换坐席自身在线状态（在线/离开/离线），广播给访客端 */
  setPresence: (status: 'online' | 'away' | 'offline') => void;
}

/**
 * 对接 chat-support-service 的 Socket.io `/chat` 命名空间（坐席端）。
 *
 * 安全（P0）：连接携带 BFF 兑换的 chat token（socket.handshake.auth.token），
 * 坐席身份由网关从 token 推导，报文中不再携带 userEmail / sender。
 */
export function useChatSocket(params: { token: string | null }): UseChatSocketResult {
  const { token } = params;

  const socketRef = useRef<Socket | null>(null);
  // S2a 改造：handlersRef 从 Map<event, cb> → Map<event, Set<cb>> 支持多播
  const handlersRef = useRef<Map<string, Set<(...args: unknown[]) => void>>>(new Map());
  const tokenRef = useRef<string | null>(token ?? null);
  const authedTokenRef = useRef<string | null>(null);
  const manualOfflineRef = useRef(false);
  // 服务端权威状态是否已同步（my-presence 是否已到达）：未同步前
  // 禁止 visibilitychange 自动报 online，避免首次登录未手动上线的坐席
  // 在竞态窗口内被自动上线。
  const presenceSyncedRef = useRef(false);
  const [connected, setConnected] = useState(false);

  /** 注册事件监听器（支持多个回调同时订阅同一事件） */
  const on = useCallback(
    <K extends keyof ChatAgentEventMap>(event: K, cb: (payload: ChatAgentEventMap[K]) => void) => {
      const eventSet = handlersRef.current.get(event) || new Set<(...args: unknown[]) => void>();
      eventSet.add(cb as (...args: unknown[]) => void);
      handlersRef.current.set(event, eventSet);

      socketRef.current?.on(event as string, cb as (...args: unknown[]) => void);

      // 返回 unsubscribe 函数
      return () => {
        off(event, cb);
      };
    },
    [],
  );

  /** 移除指定事件的特定回调；off(event) 全清仅供内部使用 */
  const off = useCallback(
    <K extends keyof ChatAgentEventMap>(event: K, cb?: (payload: ChatAgentEventMap[K]) => void) => {
      if (!cb) {
        // 全清空该事件的所有监听器（仅供内部清理使用）
        handlersRef.current.delete(event);
        socketRef.current?.off(event as string);
        return;
      }

      const eventSet = handlersRef.current.get(event);
      if (eventSet) {
        eventSet.delete(cb as (...args: unknown[]) => void);
        // 无论是否空 Set，都要从 socket 移除该回调（避免多订阅互踩）
        socketRef.current?.off(event as string, cb as (...args: unknown[]) => void);
        if (eventSet.size === 0) {
          handlersRef.current.delete(event);
        }
      }
    },
    [],
  );

  useEffect(() => {
    tokenRef.current = token ?? null;
    const sock = socketRef.current;
    if (token && token !== authedTokenRef.current && sock) {
      authedTokenRef.current = token;
      sock.auth = { token };
      if (sock.connected) {
        // 已连接 + token 变更 → 断开重连以携带新 token
        sock.disconnect();
        sock.connect();
      } else if (!manualOfflineRef.current) {
        // 未连接（如 auth-error 被服务端强制断开）→ 显式触发重连
        sock.connect();
      }
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    (async () => {
      const { io } = await import('socket.io-client');
      if (cancelled) return;
      const sock = io(`${SOCKET_URL}/chat`, {
        transports: ['websocket', 'polling'],
        auth: { token: tokenRef.current ?? undefined },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
      });
      socket = sock;
      socketRef.current = sock;
      if (tokenRef.current) authedTokenRef.current = tokenRef.current;

      sock.on('connect', () => {
        setConnected(true);
        sock.emit('register-agent');
        // 坐席在线态以服务端为唯一权威：首次登录的坐席保持 offline 等待手动
        // 上线，刷新/重连自动恢复 online（manualOffline 优先级最高）——因此
        // 客户端不得无条件上报 set-presence: online，否则会冲掉服务端的
        // offline 语义。真实状态由 my-presence 同步（见下方监听）。
        presenceSyncedRef.current = false;
        // 连接即拉取未读聚合计数（P2 M1）
        sock.emit('get-notification-counts');

        // S2a 重连补挂：遍历所有 Set 全量重新注册监听器
        for (const [event, handlers] of handlersRef.current) {
          for (const cb of handlers) {
            sock.on(event as string, cb as (...args: unknown[]) => void);
          }
        }
      });
      sock.on('disconnect', () => setConnected(false));
      sock.on('connect_error', () => setConnected(false));
      // 同步服务端权威状态：offline 可能是 manualOffline，也可能是首次登录
      // 尚未手动上线——两者刷新后都不得被 visibilitychange 自动报 online 覆盖。
      // ref 随页面重载归零，靠此处从服务端恢复。
      sock.on('my-presence', (payload: { status?: PresenceStatus }) => {
        manualOfflineRef.current = payload?.status === 'offline';
        presenceSyncedRef.current = true;
      });
      sock.on('auth-error', () => {
        setConnected(false);
        // 服务端 auth-error + disconnect(true) 会禁止 Socket.IO 自动重连。
        // 延迟 1s 后显式重连，此时 Provider 已拉取到新 token 并更新了 sock.auth。
        setTimeout(() => {
          if (!sock.connected && !manualOfflineRef.current) {
            sock.connect();
          }
        }, 1000);
      });

      const heartbeatTimer = setInterval(() => {
        if (sock.connected) sock.emit('heartbeat');
      }, 30_000);

      const USER_IDLE_DELAY_MS = 2000;
      let idleDelayTimer: ReturnType<typeof setTimeout> | null = null;
      const handleVisibility = () => {
        if (document.hidden) {
          if (idleDelayTimer) clearTimeout(idleDelayTimer);
          idleDelayTimer = setTimeout(() => {
            // 手动离线时不上报 user-idle：服务端虽有 online→away 门槛兜底，
            // 但离线状态本就无需空闲信号（纵深防御）
            if (sock.connected && !manualOfflineRef.current) sock.emit('user-idle');
          }, USER_IDLE_DELAY_MS);
        } else {
          if (idleDelayTimer) {
            clearTimeout(idleDelayTimer);
            idleDelayTimer = null;
          }
          if (sock.connected && presenceSyncedRef.current && !manualOfflineRef.current) {
            sock.emit('set-presence', { status: 'online' });
          }
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);

      const handlePageHide = () => {
        try {
          if (sock.connected) sock.emit('client-gone');
        } catch {}
        try {
          sock.io?.reconnection?.(false);
        } catch {}
        try {
          sock.disconnect();
        } catch {}
      };
      window.addEventListener('pagehide', handlePageHide);
      window.addEventListener('beforeunload', handlePageHide);

      return () => {
        clearInterval(heartbeatTimer);
        if (idleDelayTimer) clearTimeout(idleDelayTimer);
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('pagehide', handlePageHide);
        window.removeEventListener('beforeunload', handlePageHide);
      };
    })();

    return () => {
      cancelled = true;
      socket?.disconnect();
      socketRef.current = null;
      authedTokenRef.current = null;
      setConnected(false);
    };
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    socketRef.current?.emit('join-room', { roomId });
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    socketRef.current?.emit('leave-room', { roomId });
  }, []);

  const sendMessage = useCallback((roomId: string, content: string, attachments?: string[]) => {
    socketRef.current?.emit('send-message', {
      roomId,
      content,
      attachments,
    });
  }, []);

  const markRead = useCallback((roomId: string) => {
    socketRef.current?.emit('mark-messages-read', { roomId });
  }, []);

  const updateStatus = useCallback(
    (roomId: string, status: string, assignedAgentEmail?: string) => {
      socketRef.current?.emit('update-room-status', {
        roomId,
        status,
        assignedAgentEmail,
      });
    },
    [],
  );

  const transferRoom = useCallback((roomId: string, toAgentEmail: string, note?: string) => {
    socketRef.current?.emit('transfer-room', { roomId, toAgentEmail, note: note || undefined });
  }, []);

  const sendTyping = useCallback((roomId: string) => {
    socketRef.current?.emit('typing', { roomId });
  }, []);

  const sendStopTyping = useCallback((roomId: string) => {
    socketRef.current?.emit('stop-typing', { roomId });
  }, []);

  const requestNotificationCounts = useCallback(() => {
    socketRef.current?.emit('get-notification-counts');
  }, []);

  const requestRoomList = useCallback(() => {
    socketRef.current?.emit('request-room-list');
  }, []);

  const setPresence = useCallback((status: 'online' | 'away' | 'offline') => {
    manualOfflineRef.current = status === 'offline';
    socketRef.current?.emit('set-presence', { status });
  }, []);

  return useMemo(
    () => ({
      connected,
      on,
      off,
      joinRoom,
      leaveRoom,
      sendMessage,
      markRead,
      updateStatus,
      transferRoom,
      sendTyping,
      sendStopTyping,
      requestNotificationCounts,
      requestRoomList,
      setPresence,
    }),
    // 所有函数均为 useCallback([]) 稳定引用；connected 是唯一变动项。
    // 稳定化返回对象避免消费方 effect 依赖数组因「每次渲染新对象」而频繁重装监听器。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      connected,
      on,
      off,
      joinRoom,
      leaveRoom,
      sendMessage,
      markRead,
      updateStatus,
      transferRoom,
      sendTyping,
      sendStopTyping,
      requestNotificationCounts,
      requestRoomList,
      setPresence,
    ],
  );
}
