'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const SOCKET_URL = (process.env.NEXT_PUBLIC_CHAT_SOCKET_URL ?? 'http://localhost:4000').replace(
  /\/$/,
  '',
);

type ChatUserType = 'client' | 'agent';

export interface UseVisitorChatResult {
  connected: boolean;
  /** 当前在线（非离线）坐席数；-1 表示尚未收到服务端信号 */
  agentsOnline: number;
  /** 当前离开（away）坐席数 */
  agentsAway: number;
  /** 所有坐席中最近一次活跃的时间戳（ms）；用于「最后在线时间」提示，null 表示未知 */
  agentLastOnlineAt: number | null;
  on: (event: string, cb: (...args: any[]) => void) => void;
  off: (event: string) => void;
  joinRoom: (roomId: string, userEmail: string) => void;
  leaveRoom: (roomId: string) => void;
  sendMessage: (
    roomId: string,
    content: string,
    senderEmail: string,
    attachments?: string[],
  ) => void;
  markRead: (roomId: string, userEmail: string) => void;
}

/**
 * 对接 chat-support-service 的 Socket.io `/chat` 命名空间（访客端）。
 * 访客无需 register-agent，直接 join-room 后收发消息即可。
 */
export function useVisitorChat(): UseVisitorChatResult {
  const socketRef = useRef<any>(null);
  const handlersRef = useRef<Record<string, (...args: any[]) => void>>({});
  const [connected, setConnected] = useState(false);
  const [agentsOnline, setAgentsOnline] = useState(-1);
  const [agentsAway, setAgentsAway] = useState(0);
  const [agentLastOnlineAt, setAgentLastOnlineAt] = useState<number | null>(null);

  const on = useCallback((event: string, cb: (...args: any[]) => void) => {
    handlersRef.current[event] = cb;
    socketRef.current?.on(event, cb);
  }, []);

  const off = useCallback((event: string) => {
    delete handlersRef.current[event];
    socketRef.current?.off(event);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let socket: any;

    (async () => {
      const { io } = await import('socket.io-client');
      if (cancelled) return;
      socket = io(`${SOCKET_URL}/chat`, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
      });
      socketRef.current = socket;

      socket.on('connect', () => setConnected(true));
      socket.on('disconnect', () => setConnected(false));
      socket.on('connect_error', () => setConnected(false));

      // 坐席可用性：连接即下发快照，此后每次坐席上下线实时更新
      socket.on(
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

      // 注册 connect 之前已声明的业务事件处理器
      Object.entries(handlersRef.current).forEach(([event, cb]) => {
        socket.on(event, cb);
      });

      // ── 心跳：每 30s 发一次，服务端刷新 lastSeen ──
      const heartbeatTimer = setInterval(() => {
        if (socket.connected) socket.emit('heartbeat');
      }, 30_000);

      // ── 空闲检测：标签页隐藏 → 报告 idle；切回 → 心跳恢复 online ──
      const handleVisibility = () => {
        if (document.hidden) {
          socket.emit('user-idle');
        } else if (socket.connected) {
          socket.emit('heartbeat');
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);

      return () => {
        clearInterval(heartbeatTimer);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    })();

    return () => {
      cancelled = true;
      socket?.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, []);

  const joinRoom = useCallback((roomId: string, userEmail: string) => {
    socketRef.current?.emit('join-room', {
      roomId,
      userEmail,
      userType: 'client' as ChatUserType,
    });
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    socketRef.current?.emit('leave-room', { roomId });
  }, []);

  const sendMessage = useCallback(
    (roomId: string, content: string, senderEmail: string, attachments?: string[]) => {
      socketRef.current?.emit('send-message', {
        roomId,
        content,
        sender: 'client' as ChatUserType,
        senderEmail,
        attachments,
      });
    },
    [],
  );

  const markRead = useCallback((roomId: string, userEmail: string) => {
    socketRef.current?.emit('mark-messages-read', {
      roomId,
      userEmail,
      userType: 'client' as ChatUserType,
    });
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
  };
}
