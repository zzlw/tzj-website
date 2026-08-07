'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { PresenceStatus } from './types';
import { type UseChatSocketResult, useChatSocket } from './useChatSocket';

interface ChatPresenceContextValue {
  connected: boolean;
  agentStatus: PresenceStatus;
  setPresence: (status: PresenceStatus) => void;
  agentEmail: string;
  socket: UseChatSocketResult;
  /** 我的未读总数（分配给我的会话 + 待认领会话） */
  actionableUnread: number;
  /** 更新 actionableUnread */
  setActionableUnread: (unread: number) => void;
}

const ChatPresenceContext = createContext<ChatPresenceContextValue | null>(null);

/** 空闲 N 毫秒后自动置为 away */
const IDLE_AWAY_MS = 5 * 60 * 1000;

/**
 * 全局坐席在线状态与 socket 连接。
 * 挂载于 (dashboard) layout 层，确保切菜单时连接不断、坐席不会误变 offline。
 *
 * 安全（P0）：socket 连接使用 BFF 兑换的 chat token；token 每 10 分钟刷新一次，
 * 并在鉴权失败（auth-error）时重新兑换，避免 15 分钟有效期过期后掉线。
 */
export function useChatPresence(): ChatPresenceContextValue {
  const ctx = useContext(ChatPresenceContext);
  if (!ctx) {
    throw new Error('useChatPresence must be used within <ChatPresenceProvider>');
  }
  return ctx;
}

export function ChatPresenceProvider({
  agentEmail,
  children,
}: {
  agentEmail: string;
  children: React.ReactNode;
}) {
  const [token, setToken] = useState<string | null>(null);
  const socket = useChatSocket({ token });

  /** 我的未读总数（分配给我的会话 + 待认领会话） */
  const [actionableUnread, setActionableUnread] = useState(0);

  // 429/网络抖动时避免 auth-error 驱动的高频重试把限流桶打满
  const lastFetchAttemptRef = useRef(0);
  const fetchToken = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchAttemptRef.current < 3000) return;
    lastFetchAttemptRef.current = now;
    try {
      const res = await fetch('/api/chat/token', { method: 'POST' });
      if (res.ok) {
        const data = (await res.json()) as { token: string };
        setToken(data.token);
      }
    } catch {
      // 网络/服务异常：保持现有 token（若有），下次重试
    }
  }, []);

  // 首次拉取 + 每 10 分钟刷新（token 有效期 15 分钟，留出余量）
  // P1-5：追加 visibilitychange 监听，电脑休眠唤醒后主动补一次刷新，
  // 避免 15 分钟窗口错过后静默掉线。加 30s 节流防止频繁切 tab 打请求。
  const lastFetchRef = useRef(0);
  useEffect(() => {
    void fetchToken();
    lastFetchRef.current = Date.now();
    const id = setInterval(
      () => {
        void fetchToken();
        lastFetchRef.current = Date.now();
      },
      10 * 60 * 1000,
    );

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetchRef.current > 30_000) {
        void fetchToken();
        lastFetchRef.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchToken]);

  // 鉴权失败 → 立即重新兑换 token 并触发重连
  useEffect(() => {
    const handler = () => void fetchToken();
    socket.on('auth-error', handler);
    return () => socket.off('auth-error', handler);
  }, [socket, fetchToken]);

  const [agentStatus, setAgentStatus] = useState<PresenceStatus>('offline');

  const idleAwayRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPresence = useCallback(
    (status: PresenceStatus) => {
      setAgentStatus(status);
      socket.setPresence(status);
      idleAwayRef.current = false;
    },
    [socket],
  );

  useEffect(() => {
    // my-presence 是服务端下发的权威状态：只同步本地 state，禁止回射 set-presence。
    // 旧实现调用完整版 setPresence 会把状态原样 emit 回服务端，而服务端对任何
    // 非 offline 值都会清掉 manualOffline 标记——手动离线一旦被旁路（如 user-idle）
    // 污染成 away，回射就让「手动离线」保护永久失效（刷新后漂回在线/离开）。
    const handleMyPresence = (payload: { status: PresenceStatus }) => {
      setAgentStatus(payload.status);
      idleAwayRef.current = false;
    };
    socket.on('my-presence', handleMyPresence);
    return () => {
      socket.off('my-presence', handleMyPresence);
    };
  }, [socket]);

  // 兜底：服务端在断线宽限期、scanPresence、set-presence 等路径会广播 presence-changed，
  // 但旧实现只认 my-presence（连接时一次性下发）。刷新场景下新连接若在旧 socket 尚未
  // 移除时建立，my-presence 可能返回旧 socket 的离线/away 状态而 presence-changed 被忽略，
  // 导致「刷新后一直离线」。这里同时消费自身 userKey 的 presence-changed 以保证状态一致。
  useEffect(() => {
    const handlePresenceChanged = (payload: {
      userEmail: string;
      userType: 'client' | 'agent';
      status: PresenceStatus;
    }) => {
      if (payload.userType === 'agent' && payload.userEmail === agentEmail) {
        setAgentStatus(payload.status);
      }
    };
    socket.on('presence-changed', handlePresenceChanged);
    return () => {
      socket.off('presence-changed', handlePresenceChanged);
    };
  }, [socket, agentEmail]);

  useEffect(() => {
    function resetIdleTimer() {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        if (socket.setPresence && !idleAwayRef.current) {
          setAgentStatus((prev) => {
            if (prev !== 'online') return prev;
            idleAwayRef.current = true;
            socket.setPresence('away');
            return 'away';
          });
        }
      }, IDLE_AWAY_MS);
    }

    function onActivity() {
      if (idleAwayRef.current) {
        idleAwayRef.current = false;
        setAgentStatus('online');
        socket.setPresence('online');
      }
      resetIdleTimer();
    }

    resetIdleTimer();
    window.addEventListener('mousemove', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, [socket]);

  return (
    <ChatPresenceContext.Provider
      value={{
        connected: socket.connected,
        agentStatus,
        setPresence,
        agentEmail,
        socket,
        actionableUnread,
        setActionableUnread,
      }}
    >
      {children}
    </ChatPresenceContext.Provider>
  );
}
