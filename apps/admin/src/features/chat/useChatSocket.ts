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

      // ── 空闲检测：标签页隐藏 → 延迟报告 idle；切回 → 恢复 online ──
      // 仅当坐席曾显式点击过「在线」后才允许 visibility 自动恢复；
      // 首次加载默认 offline 时，切标签页不会误变 online。
      // 关键修复：隐藏时不立即 emit user-idle，而是延迟 USER_IDLE_DELAY_MS 再发。
      // 刷新 / 关闭标签页时页面会在延迟前卸载（定时器随之清除、连接已断），
      // 不会污染服务端 presence，避免「刷新后坐席从在线变成离开」。
      const USER_IDLE_DELAY_MS = 2000;
      let idleDelayTimer: ReturnType<typeof setTimeout> | null = null;
      const handleVisibility = () => {
        if (document.hidden) {
          if (idleDelayTimer) clearTimeout(idleDelayTimer);
          idleDelayTimer = setTimeout(() => {
            if (socket.connected) socket.emit('user-idle');
          }, USER_IDLE_DELAY_MS);
        } else {
          if (idleDelayTimer) {
            clearTimeout(idleDelayTimer);
            idleDelayTimer = null;
          }
          if (socket.connected && hasEverBeenOnlineRef.current && !manualOfflineRef.current) {
            socket.emit('set-presence', { status: 'online' });
          }
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);

      // ── 页面销毁（关闭标签页 / 离开站点）时主动上报「离开」──
      // 仅靠 socket 自然断开不可靠：标签页关闭瞬间 WS 关闭帧可能来不及发出，
      // 导致服务端要等断线宽限 + ping 超时才能检测离线。故在 pagehide/beforeunload
      // （页面销毁前可靠触发）显式发送 client-gone，服务端走「显式离开」快路径，
      // 比 10s 断线宽限更快让 C 端反映「暂无坐席在线」。刷新时新连接会在
      // CLIENT_GONE_GRACE_MS 窗口内重连并取消离线定时器，坐席不丢在线。
      const handlePageHide = () => {
        try {
          if (socket.connected) socket.emit('client-gone');
        } catch {}
        try {
          // 仅禁用本（即将销毁的）socket 所属 Manager 的重连；
          // 新页面会创建全新 socket（重连默认开启），刷新仍可正常恢复。
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
  // 注意：online / away 都说明坐席曾处于活跃态，刷新后经 my-presence 回放时
  // 一并置位 hasEverBeenOnlineRef，使「切回前台自动恢复 online」闸门在刷新后仍有效；
  // 仅 offline（含手动离线 / 首次加载默认 offline）不置位，尊重「不自动上线」意图。
  const setPresence = useCallback(
    (status: 'online' | 'away' | 'offline') => {
      manualOfflineRef.current = status === 'offline';
      if (status !== 'offline') hasEverBeenOnlineRef.current = true;
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
