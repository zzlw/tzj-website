'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collectVisitorContext,
  createRoom,
  fetchVisitorToken,
  getRoom,
  sendMessageHTTP,
} from '@/features/chat/api';
import { normalizeMessage } from '@/features/chat/message-utils';
import type { ChatAttachment, ChatMessage, ChatRoom } from '@/features/chat/types';

const STORAGE_KEY = 'tzj_chat_visitor';

// 生成游客占位邮箱（合法 email 格式，后端 @IsEmail() 校验通过）
function generateGuestEmail(): string {
  const rand = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return `visitor-${rand}@guest.local`;
}

export interface UseChatSessionOptions {
  /** 访客 chat token（状态由 ChatWidget 持有，因 useVisitorChat(token) 需先于本 hook 调用） */
  token: string | null;
  /** 回写 token（建房/恢复/续期时调用，驱动 useVisitorChat 鉴权重连） */
  setToken: (token: string | null) => void;
  /** socket 是否已连接（重连后自动重新加入房间） */
  connected: boolean;
  /** 服务端 auth-error 信号（token 失效），触发续期链路 */
  authError: boolean;
  /** 加入 socket 房间（useVisitorChat 提供） */
  joinRoom: (roomId: string) => void;
  /** 离开 socket 房间（useVisitorChat 提供） */
  leaveRoom: (roomId: string) => void;
  /** 发送失败提示文案（i18n t.failed） */
  failedText: string;
}

export interface UseChatSessionResult {
  room: ChatRoom | null;
  setRoom: React.Dispatch<React.SetStateAction<ChatRoom | null>>;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  /** 会话级错误提示（建房/发送失败等）；上传失败等场景由上层直接 setError */
  error: string;
  setError: React.Dispatch<React.SetStateAction<string>>;
  /** 首条消息发送中（建房 + HTTP 落库） */
  sending: boolean;
  isClosed: boolean;
  roomIdRef: React.MutableRefObject<string | null>;
  clientEmailRef: React.MutableRefObject<string | null>;
  /** 最近一次经 socket 发出但尚未确认的消息（ROOM_ARCHIVED 承接用） */
  pendingOutgoingRef: React.MutableRefObject<{
    content: string;
    attachments: ChatAttachment[];
  } | null>;
  /** restartWithMessage 的运行时引用，供 socket 'error' 回调调用，避免闭包过期 */
  restartWithMessageRef: React.MutableRefObject<
    ((content: string, attachments: ChatAttachment[]) => void) | null
  >;
  /** 确保存在房间：无房间时先建一个空房间（用于首次即带附件的场景） */
  ensureRoom: () => Promise<{ roomId: string; email: string } | null>;
  /** 发送第一条消息（无房间时先建房，再走 HTTP 落库，支持附件） */
  sendFirstMessage: (content: string, attachments: ChatAttachment[]) => Promise<void>;
  /** 承接一条消息开启「新会话」（归档会话冷存终态场景） */
  restartWithMessage: (content: string, attachments: ChatAttachment[]) => void;
  /** 「新对话」入口：离开旧房间 + 清空本地状态 */
  startNewChat: () => void;
}

/**
 * 访客会话/token 生命周期（从 ChatWidget 拆出，行为不变）：
 * 本地恢复、token 续期、重连重加入、建房、首条消息、归档承接与新会话。
 */
export function useChatSession({
  token,
  setToken,
  connected,
  authError,
  joinRoom,
  leaveRoom,
  failedText,
}: UseChatSessionOptions): UseChatSessionResult {
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const roomIdRef = useRef<string | null>(null);
  const clientEmailRef = useRef<string | null>(null);
  // 最近一次经 socket 发出但尚未确认的消息：若服务端回 ROOM_ARCHIVED（归档冷存终态），
  // 据此把该消息承接到「新会话」，杜绝访客消息静默丢失（业内最佳实践 Zendesk/Intercom）。
  const pendingOutgoingRef = useRef<{ content: string; attachments: ChatAttachment[] } | null>(
    null,
  );
  // restartWithMessage 在下方定义，用 ref 供 socket 事件回调运行时调用，避免闭包过期。
  const restartWithMessageRef = useRef<
    ((content: string, attachments: ChatAttachment[]) => void) | null
  >(null);

  const isClosed = room?.status === 'closed';

  const enterChat = useCallback(
    (r: ChatRoom, chatToken?: string) => {
      setRoom(r);
      setMessages((r.messages ?? []).map(normalizeMessage));
      roomIdRef.current = r.roomId;
      clientEmailRef.current = r.clientEmail;
      if (chatToken) {
        setToken(chatToken);
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ email: r.clientEmail, roomId: r.roomId, token: chatToken }),
          );
        } catch {}
      }
      // 已关闭会话也加入房间：访客回复「重开」时需实时收到自己的消息回声与
      // room-status-changed（状态切回进行中）；同时关闭事件也能即时触达。
      if (r.status === 'active' || r.status === 'waiting' || r.status === 'closed') {
        joinRoom(r.roomId);
      }
    },
    [joinRoom, setToken],
  );

  // 重连后自动重新加入当前房间（token 鉴权场景下确保实时收发不丢）
  useEffect(() => {
    if (connected && roomIdRef.current && token) {
      joinRoom(roomIdRef.current);
    }
  }, [connected, token, joinRoom]);

  // 恢复（从本地存储取 roomId + token；缺 token 则凭 roomId+email 重新换取）
  useEffect(() => {
    let active = true;
    (async () => {
      let stored: { email?: string; roomId?: string; token?: string } | null = null;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) stored = JSON.parse(raw);
      } catch {}
      if (!stored?.roomId || !stored?.email) return;
      try {
        const r = await getRoom(stored.roomId, stored.email);
        if (!active || !r) return;
        // 归档会话是冷存终态（业内最佳实践 Zendesk/LiveChat）：访客回来时不恢复归档会话，
        // 清空本地存储，让访客自然进入「开始新对话」状态；服务端亦拒绝向归档会话发消息。
        if (r.status === 'archived') {
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch {}
          return;
        }
        if (stored.token) {
          enterChat(r, stored.token);
        } else if (stored.email) {
          const t = await fetchVisitorToken(stored.roomId, stored.email);
          enterChat(r, t.token);
        }
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, [enterChat]);

  // P1-6：访客 token 失效后续期链路——auth-error 时用 localStorage 中的 email+roomId 重新兑换 token
  useEffect(() => {
    if (!authError) return;
    let cancelled = false;
    (async () => {
      const rid = roomIdRef.current;
      const email = clientEmailRef.current;
      if (!rid || !email) return;
      try {
        const { token: newToken } = await fetchVisitorToken(rid, email);
        if (cancelled) return;
        setToken(newToken);
        // 回写 localStorage，确保刷新后也能拿到有效 token
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ email, roomId: rid, token: newToken }),
          );
        } catch {}
      } catch {
        // 兑换失败（如会话已删除）：清空本地存储，访客下次操作时将自然进入「开始新对话」
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authError, setToken]);

  /** 确保存在房间：无房间时先建一个空房间（用于首次即带附件的场景）。 */
  const ensureRoom = useCallback(async (): Promise<{
    roomId: string;
    email: string;
  } | null> => {
    if (room && roomIdRef.current) {
      return { roomId: room.roomId, email: room.clientEmail };
    }
    try {
      const guestEmail = generateGuestEmail();
      const created = await createRoom({
        clientEmail: guestEmail,
        ...collectVisitorContext(),
      });
      enterChat(created, created.token);
      return { roomId: created.roomId, email: created.clientEmail };
    } catch {
      setError(failedText);
      return null;
    }
  }, [room, enterChat, failedText]);

  // 发送第一条消息（无房间时先建房，再走 HTTP 落库，支持附件）
  const sendFirstMessage = useCallback(
    async (content: string, attachments: ChatAttachment[]) => {
      if (sending) return;
      setSending(true);
      setError('');
      try {
        const guestEmail = generateGuestEmail();
        const created = await createRoom({
          clientEmail: guestEmail,
          ...collectVisitorContext(),
        });
        enterChat(created, created.token);
        const keys = attachments.map((a) => a.key);
        const persisted = await sendMessageHTTP(created.roomId, content, guestEmail, keys);
        setMessages((persisted.messages ?? []).map(normalizeMessage));
      } catch {
        setError(failedText);
      } finally {
        setSending(false);
      }
    },
    [sending, enterChat, failedText],
  );

  // 承接一条消息开启「新会话」：用于访客向「已归档」会话发消息的场景。
  // 归档=冷存终态（业内最佳实践 Zendesk/Intercom）：不向归档会话追加消息，而是离开旧房间、
  // 清空本地存储后建新房 + 发送本条消息，B 端队列据此重开新对话，杜绝消息石沉大海。
  const restartWithMessage = useCallback(
    (content: string, attachments: ChatAttachment[]) => {
      // 离开归档旧房间：让 B 端按房间成员关系把旧会话的访客判定为离线。
      if (roomIdRef.current) {
        try {
          leaveRoom(roomIdRef.current);
        } catch {}
      }
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
      roomIdRef.current = null;
      clientEmailRef.current = null;
      setRoom(null);
      setMessages([]);
      void sendFirstMessage(content, attachments);
    },
    [leaveRoom, sendFirstMessage],
  );

  // 同步 restartWithMessage 到 ref，供 socket 'error'（ROOM_ARCHIVED）回调运行时调用。
  useEffect(() => {
    restartWithMessageRef.current = restartWithMessage;
  }, [restartWithMessage]);

  const startNewChat = useCallback(() => {
    // 离开旧房间：让访客 socket 退出当前会话房间（socket.io room），
    // 网关据此广播 user-left，并按「房间成员关系」将该旧会话的访客判定为离线 → B 端旧会话立即显示离线。
    // 注意：离开房间不改变访客的「全局在线状态」（socket 仍在线，只是不再在该会话房间内），
    // 新会话（发出首条消息时生成新身份并加入新房间）会显示在线。双方均以房间成员关系为准，刷新亦一致。
    // 必须在清空 room 状态前用 roomIdRef 取到旧 roomId。
    if (roomIdRef.current) {
      try {
        leaveRoom(roomIdRef.current);
      } catch {}
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setRoom(null);
    setMessages([]);
    roomIdRef.current = null;
  }, [leaveRoom]);

  return {
    room,
    setRoom,
    messages,
    setMessages,
    error,
    setError,
    sending,
    isClosed,
    roomIdRef,
    clientEmailRef,
    pendingOutgoingRef,
    restartWithMessageRef,
    ensureRoom,
    sendFirstMessage,
    restartWithMessage,
    startNewChat,
  };
}
