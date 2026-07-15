'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const SOCKET_URL = (process.env.NEXT_PUBLIC_CHAT_SOCKET_URL ?? 'http://localhost:4000').replace(
  /\/$/,
  '',
);

type ChatUserType = 'client' | 'agent';

export interface UseChatSocketResult {
  connected: boolean;
  /** 注册一次性/持续性事件监听 */
  on: (event: string, cb: (...args: any[]) => void) => void;
  off: (event: string) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendMessage: (roomId: string, content: string, attachments?: string[]) => void;
  markRead: (roomId: string) => void;
  updateStatus: (roomId: string, status: string, assignedAgentEmail?: string) => void;
  /** 切换坐席自身在线状态（在线/离开/离线），广播给访客端 */
  setPresence: (status: 'online' | 'away' | 'offline') => void;
}

/**
 * 对接 chat-support-service 的 Socket.io `/chat` 命名空间。
 * 连接成功后自动以 agent 身份注册，服务端随即推送 room-list-updated。
 */
export function useChatSocket(params: {
  userEmail: string;
  userType?: ChatUserType;
}): UseChatSocketResult {
  const { userEmail, userType = 'agent' } = params;

  const socketRef = useRef<any>(null);
  const handlersRef = useRef<Record<string, (...args: any[]) => void>>({});
  // 标记坐席是否「手动离线」，用于在切回前台时不把手动离线覆盖回在线
  const manualOfflineRef = useRef(false);
  // 标记坐席是否曾显式上线过：仅在曾上线后才允许 visibility 自动恢复 online
  const hasEverBeenOnlineRef = useRef(false);
  const [connected, setConnected] = useState(false);

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

      socket.on('connect', () => {
        setConnected(true);
        socket.emit('register-agent', { userEmail });
      });
      socket.on('disconnect', () => setConnected(false));
      socket.on('connect_error', () => setConnected(false));

      // 注册在 connect 之前已声明的业务事件处理器
      Object.entries(handlersRef.current).forEach(([event, cb]) => {
        socket.on(event, cb);
      });

      // ── 心跳：每 30s 发一次，服务端刷新 lastSeen ──
      const heartbeatTimer = setInterval(() => {
        if (socket.connected) socket.emit('heartbeat');
      }, 30_000);

      // ── 空闲检测：标签页隐藏 → 报告 idle；切回 → 恢复 online ──
      // 仅当坐席曾显式点击过「在线」后才允许 visibility 自动恢复；
      // 首次加载默认 offline 时，切标签页不会误变 online。
      const handleVisibility = () => {
        if (document.hidden) {
          socket.emit('user-idle');
        } else if (socket.connected && hasEverBeenOnlineRef.current) {
          if (!manualOfflineRef.current) {
            socket.emit('set-presence', { status: 'online' });
          }
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
  }, [userEmail]);

  const joinRoom = useCallback(
    (roomId: string) => {
      socketRef.current?.emit('join-room', { roomId, userEmail, userType });
    },
    [userEmail, userType],
  );

  const leaveRoom = useCallback((roomId: string) => {
    socketRef.current?.emit('leave-room', { roomId });
  }, []);

  const sendMessage = useCallback(
    (roomId: string, content: string, attachments?: string[]) => {
      socketRef.current?.emit('send-message', {
        roomId,
        content,
        sender: userType,
        senderEmail: userEmail,
        attachments,
      });
    },
    [userEmail, userType],
  );

  const markRead = useCallback(
    (roomId: string) => {
      socketRef.current?.emit('mark-messages-read', {
        roomId,
        userEmail,
        userType,
      });
    },
    [userEmail, userType],
  );

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

  // 坐席切换自身在线状态：经 set-presence 上报后端，由网关更新内存 presence
  // 并广播聚合态，C 端访客即可看到坐席真实在线/离开/离线。
  const setPresence = useCallback(
    (status: 'online' | 'away' | 'offline') => {
      manualOfflineRef.current = status === 'offline';
      if (status === 'online') hasEverBeenOnlineRef.current = true;
      socketRef.current?.emit('set-presence', { status });
    },
    [userEmail, userType],
  );

  return {
    connected,
    on,
    off,
    joinRoom,
    leaveRoom,
    sendMessage,
    markRead,
    updateStatus,
    setPresence,
  };
}
