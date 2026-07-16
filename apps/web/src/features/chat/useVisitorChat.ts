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
  /** 主动报告「正在看聊天」：打开面板 / 切回前台 → 恢复 online */
  reportActive: () => void;
  /** 主动报告「离开聊天」：关闭面板 / 切到后台 → 置为 away */
  reportIdle: () => void;
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

      // ── 空闲检测：标签页隐藏 → 报告 idle；切回 → 恢复 active(online) ──
      const handleVisibility = () => {
        if (document.hidden) {
          socket.emit('user-idle');
        } else if (socket.connected) {
          socket.emit('user-active');
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);

      // ── 页面彻底销毁（关闭标签页 / 离开站点）时主动上报离线 ──
      // 仅靠 socket 自然断开不可靠：标签页关闭瞬间 websocket 关闭帧可能
      // 来不及发出，导致服务端要等 ping 超时（~15s）才检测断线，叠加宽限
      // 后 B 端长期显示「在线」。故在 pagehide/beforeunload（页面销毁前
      // 可靠触发）显式发送 client-gone，服务端收到后立即将该客户置为 offline。
      // 多标签页时其它 socket 仍在，不会误判；刷新时新连接会经 registerSocket
      // 立即恢复 online，不会误判为长期离线。
      const handlePageHide = () => {
        try {
          socket.emit('client-gone');
        } catch {}
        try {
          // 关键：关闭/离开页面时彻底禁止自动重连。
          // 否则页面卸载瞬间底层 WS 被浏览器粗暴切断，socket.io 因
          // reconnection:true + reconnectionDelay:1000 会在约 1s 后重连，
          // 经 registerSocket 把已 offline 的访客再次拉回 online
          // —— 表现为「瞬间离线 1 秒左右，又变成在线」。
          // 仅禁用本（即将销毁的）socket 所属 Manager 的重连；
          // 新页面会创建全新 socket（重连默认开启），刷新仍可正常恢复在线。
          socket.io?.reconnection?.(false);
        } catch {}
        try {
          socket.disconnect();
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
      // 断开前先诚实上报「离开聊天」，使 B 端状态在组件卸载（离开页面）时及时变为 away
      try {
        socketRef.current?.emit('user-idle');
      } catch {}
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

  // 诚实上报客户在线状态：打开面板 / 切回前台 → online；关闭面板 / 切到后台 → away
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
    reportActive,
    reportIdle,
  };
}
