'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { ChatMessage } from '@/features/chat/types';

const SOCKET_URL = (process.env.NEXT_PUBLIC_CHAT_SOCKET_URL ?? 'http://localhost:4000').replace(
  /\/$/,
  '',
);

type ChatUserType = 'client' | 'agent';

/** 访客端（/chat 命名空间）事件契约：事件名 → 负载类型，供 on/off 强类型分发 */
type ChatVisitorEventMap = {
  'new-message': { message?: ChatMessage; room?: { roomId: string } };
  'messages-read': { userType?: string; roomId?: string; userEmail?: string };
  'presence-changed': {
    userEmail?: string;
    userType?: string;
    status?: 'online' | 'away' | 'offline';
  };
  'room-status-changed': { roomId?: string; status?: string };
  /** 转接通知（访客端收到）：会话被转接给其他坐席 */
  'room-transfer-notice': { roomId?: string; toAgentName?: string; transferredBy?: string };
  /** 对方（坐席）正在输入（P1 H2） */
  typing: { roomId?: string; userEmail?: string; userType?: string };
  /** 对方（坐席）停止输入（P1 H2） */
  'stop-typing': { roomId?: string; userEmail?: string; userType?: string };
  /** 通知计数聚合（P2 M1）：初始拉取 + 增量更新，形状一致 */
  'notification-counts': ChatNotificationCounts;
  'notification-counts-updated': ChatNotificationCounts;
  error: { message?: string };
};

/** 通知计数聚合负载（P2 M1） */
type ChatNotificationCounts = {
  totalUnread: number;
  roomCounts?: Array<{ roomId: string; unreadCount: number; clientEmail?: string; status?: string }>;
};

export interface UseVisitorChatResult {
  connected: boolean;
  /** 当前在线（非离线）坐席数；-1 表示尚未收到服务端信号 */
  agentsOnline: number;
  /** 当前离开（away）坐席数 */
  agentsAway: number;
  /** 所有坐席中最近一次活跃的时间戳（ms）；用于「最后在线时间」提示，null 表示未知 */
  agentLastOnlineAt: number | null;
  on: <K extends keyof ChatVisitorEventMap>(
    event: K,
    cb: (payload: ChatVisitorEventMap[K]) => void,
  ) => void;
  off: <K extends keyof ChatVisitorEventMap>(event: K) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendMessage: (roomId: string, content: string, attachments?: string[]) => void;
  markRead: (roomId: string) => void;
  /** 标记「正在输入」（P1 H2），用于通知对方显示「正在输入…」 */
  sendTyping: (roomId: string, text?: string) => void;
  /** 标记「停止输入」（P1 H2） */
  sendStopTyping: (roomId: string) => void;
  /** 主动拉取未读聚合计数（P2 M1） */
  requestNotificationCounts: () => void;
  /** 主动报告「正在看网站」：切回前台可见 → 恢复 online（与聊天面板是否打开无关） */
  reportActive: () => void;
  /** 主动报告「离开网站」：切到后台隐藏 → 置为 away（与聊天面板是否打开无关） */
  reportIdle: () => void;
  /** 上报「聊天面板开关」：独立 engagement 信号，不影响 online/away（仅供 B 端「正在查看对话」提示） */
  reportPanelState: (open: boolean) => void;
  /** 外部覆写坐席在线数（REST 兜底场景） */
  setAgentsOnline: (n: number) => void;
  /** 外部覆写坐席离开数（REST 兜底 / 定时再同步场景） */
  setAgentsAway: (n: number) => void;
}

/**
 * 对接 chat-support-service 的 Socket.io `/chat` 命名空间（访客端）。
 *
 * 安全（P0）：连接携带服务端签发的 chat token（socket.handshake.auth.token），
 * 发送者身份由网关从 token 推导，客户端报文不再携带 userEmail / sender。
 */
export function useVisitorChat(token: string | null): UseVisitorChatResult {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef<Record<string, (...args: unknown[]) => void>>({});
  const tokenRef = useRef<string | null>(token ?? null);
  const authedTokenRef = useRef<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [agentsOnline, setAgentsOnline] = useState(-1);
  const [agentsAway, setAgentsAway] = useState(0);
  const [agentLastOnlineAt, setAgentLastOnlineAt] = useState<number | null>(null);

  const on = useCallback(
    <K extends keyof ChatVisitorEventMap>(
      event: K,
      cb: (payload: ChatVisitorEventMap[K]) => void,
    ) => {
      handlersRef.current[event] = cb as unknown as (...args: unknown[]) => void;
      socketRef.current?.on(event as string, cb as (...args: unknown[]) => void);
    },
    [],
  );

  const off = useCallback(<K extends keyof ChatVisitorEventMap>(event: K) => {
    delete handlersRef.current[event];
    socketRef.current?.off(event);
  }, []);

  // token 变化时（如首次建房后拿到 token、或重连换发），以鉴权身份重连
  useEffect(() => {
    tokenRef.current = token ?? null;
    const sock = socketRef.current;
    if (token && token !== authedTokenRef.current && sock) {
      authedTokenRef.current = token;
      sock.auth = { token };
      if (sock.connected) {
        sock.disconnect();
        sock.connect();
      } else {
        // 未连接（如 auth-error 被服务端强制断开）→ 显式触发重连
        sock.connect();
      }
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;
    // 保存内部清理函数，确保 async IIFE 返回的资源清理逻辑能被执行
    let innerCleanup: (() => void) | null = null;

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
        // 连接即拉取未读聚合计数（P2 M1）
        sock.emit('get-notification-counts');
      });
      sock.on('disconnect', () => setConnected(false));
      sock.on('connect_error', () => setConnected(false));
      // 鉴权失败：保持断开，由上层重新换取 token 后重连
      sock.on('auth-error', () => {
        setConnected(false);
        // 服务端 auth-error + disconnect(true) 会禁止 Socket.IO 自动重连。
        // 延迟 1s 后显式重连，此时上层已拉取到新 token 并更新了 sock.auth。
        setTimeout(() => {
          if (!sock.connected) sock.connect();
        }, 1000);
      });

      sock.on(
        'agents-online',
        (data: { online?: number; away?: number; lastOnlineAt?: number | null }) => {
          const n = typeof data?.online === 'number' ? data.online : 0;
          setAgentsOnline(n);
          if (typeof data?.away === 'number') setAgentsAway(data.away);
          if (typeof data?.lastOnlineAt === 'number') {
            setAgentLastOnlineAt(data.lastOnlineAt);
          } else if (data?.lastOnlineAt === null) {
            setAgentLastOnlineAt(null);
          }
        },
      );

      Object.entries(handlersRef.current).forEach(([event, cb]) => {
        sock.on(event, cb);
      });

      const heartbeatTimer = setInterval(() => {
        if (sock.connected) sock.emit('heartbeat');
      }, 30_000);

      const handleVisibility = () => {
        if (document.hidden) {
          sock.emit('user-idle');
        } else if (sock.connected) {
          sock.emit('user-active');
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);

      const handlePageHide = () => {
        try {
          sock.emit('client-gone');
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

      // 保存内部清理函数，供外层 cleanup 调用
      innerCleanup = () => {
        clearInterval(heartbeatTimer);
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('pagehide', handlePageHide);
        window.removeEventListener('beforeunload', handlePageHide);
      };
    })();

    return () => {
      cancelled = true;
      // 执行内部清理：清除心跳定时器、移除事件监听器
      innerCleanup?.();
      try {
        socketRef.current?.emit('user-idle');
      } catch {}
      socket?.disconnect();
      socketRef.current = null;
      authedTokenRef.current = null;
      setConnected(false);
    };
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    socketRef.current?.emit('join-room', {
      roomId,
      userType: 'client' as ChatUserType,
    });
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
    socketRef.current?.emit('mark-messages-read', {
      roomId,
    });
  }, []);

  const sendTyping = useCallback((roomId: string, text?: string) => {
    socketRef.current?.emit('typing', { roomId, text });
  }, []);

  const sendStopTyping = useCallback((roomId: string) => {
    socketRef.current?.emit('stop-typing', { roomId });
  }, []);

  const requestNotificationCounts = useCallback(() => {
    socketRef.current?.emit('get-notification-counts');
  }, []);

  const reportIdle = useCallback(() => {
    socketRef.current?.emit('user-idle');
  }, []);
  const reportActive = useCallback(() => {
    socketRef.current?.emit('user-active');
  }, []);
  const reportPanelState = useCallback((open: boolean) => {
    // 面板开关仅作为 engagement 信号，不改变在线态（业内最佳实践：
    // 在线/离开只看连接 + 标签页可见 + 是否长时间无操作）。
    socketRef.current?.emit('chat-panel', { open });
  }, []);

  return useMemo(
    () => ({
      connected,
      agentsOnline,
      agentsAway,
      agentLastOnlineAt,
      on,
      off,
      joinRoom,
      leaveRoom,
      sendMessage,
      markRead,
      sendTyping,
      sendStopTyping,
      requestNotificationCounts,
      reportActive,
      reportIdle,
      reportPanelState,
      setAgentsOnline,
      setAgentsAway,
    }),
    // 函数均为 useCallback([]) 稳定引用；状态项为唯一变动项。
    // 稳定化返回对象，避免消费方因「每次渲染新对象」而重装监听器。
    [connected, agentsOnline, agentsAway, agentLastOnlineAt, on, off, joinRoom, leaveRoom, sendMessage, markRead, sendTyping, sendStopTyping, requestNotificationCounts, reportActive, reportIdle, reportPanelState, setAgentsOnline, setAgentsAway],
  );
}
