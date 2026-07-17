'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  sendTyping: (roomId: string) => void;
  /** 标记「停止输入」（P1 H2） */
  sendStopTyping: (roomId: string) => void;
  /** 主动拉取未读聚合计数（P2 M1） */
  requestNotificationCounts: () => void;
  /** 主动报告「正在看聊天」：打开面板 / 切回前台 → 恢复 online */
  reportActive: () => void;
  /** 主动报告「离开聊天」：关闭面板 / 切到后台 → 置为 away */
  reportIdle: () => void;
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

      return () => {
        clearInterval(heartbeatTimer);
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('pagehide', handlePageHide);
        window.removeEventListener('beforeunload', handlePageHide);
      };
    })();

    return () => {
      cancelled = true;
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

  const sendTyping = useCallback((roomId: string) => {
    socketRef.current?.emit('typing', { roomId });
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

  return {
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
  };
}
