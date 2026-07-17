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

  const fetchToken = useCallback(async () => {
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
  useEffect(() => {
    void fetchToken();
    const id = setInterval(() => void fetchToken(), 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchToken]);

  // 鉴权失败 → 立即重新兑换 token 并触发重连
  useEffect(() => {
    const handler = () => void fetchToken();
    socket.on('auth-error', handler);
    return () => socket.off('auth-error');
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
    const handleMyPresence = (payload: { status: PresenceStatus }) => {
      setPresence(payload.status);
    };
    socket.on('my-presence', handleMyPresence);
    return () => {
      socket.off('my-presence');
    };
  }, [socket, setPresence]);

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
      }}
    >
      {children}
    </ChatPresenceContext.Provider>
  );
}
