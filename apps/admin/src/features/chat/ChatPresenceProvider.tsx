'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
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
  const socket = useChatSocket({ userEmail: agentEmail, userType: 'agent' });

  // 坐席默认离线，需显式切换在线（业内最佳实践）
  const [agentStatus, setAgentStatus] = useState<PresenceStatus>('offline');

  // 记录当前 away 是否为自动空闲触发（用于探活恢复）
  const idleAwayRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPresence = useCallback(
    (status: PresenceStatus) => {
      setAgentStatus(status);
      socket.setPresence(status);
      // 手动切换状态时清除自动空闲标记
      idleAwayRef.current = false;
    },
    [socket],
  );

  // ── 空闲检测：鼠标/键盘静止 N 分钟 → 自动 away ──
  useEffect(() => {
    function resetIdleTimer() {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        // 仅在坐席当前 online 时才自动置为 away
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
      // 自动空闲 → 恢复在线（手动 offline/away 不覆盖）
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
