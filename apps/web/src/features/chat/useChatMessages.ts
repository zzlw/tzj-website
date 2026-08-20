'use client';

import { useEffect, useRef, useState } from 'react';
import { getRoom } from '@/features/chat/api';
import { normalizeMessage } from '@/features/chat/message-utils';
import type { AgentPresenceStatus } from '@/features/chat/presence';
import type { ChatAttachment, ChatMessage, ChatRoom } from '@/features/chat/types';
import type { UseVisitorChatResult } from '@/features/chat/useVisitorChat';

export interface UseChatMessagesOptions {
  /** 面板是否打开（已读标记时机判定） */
  open: boolean;
  /** open 的 ref 镜像（socket 回调运行时读取，由 ChatWidget 维护同步） */
  openRef: React.RefObject<boolean>;
  connected: boolean;
  room: ChatRoom | null;
  isClosed: boolean;
  on: UseVisitorChatResult['on'];
  off: UseVisitorChatResult['off'];
  markRead: UseVisitorChatResult['markRead'];
  /** presence-changed 明细信号入口（useAgentPresence 提供） */
  applyPresenceSignal: (status: AgentPresenceStatus) => void;
  roomIdRef: React.MutableRefObject<string | null>;
  clientEmailRef: React.MutableRefObject<string | null>;
  pendingOutgoingRef: React.MutableRefObject<{
    content: string;
    attachments: ChatAttachment[];
  } | null>;
  restartWithMessageRef: React.MutableRefObject<
    ((content: string, attachments: ChatAttachment[]) => void) | null
  >;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setRoom: React.Dispatch<React.SetStateAction<ChatRoom | null>>;
  /** 面板未打开时收到客服消息 → 弹预览气泡（dismissed 判定留在 ChatWidget） */
  onAgentMessageWhileClosed: () => void;
}

export interface UseChatMessagesResult {
  /** 服务端未读聚合（P2 M1）：由 notification-counts(-updated) 驱动，刷新/重连后仍准确 */
  serverUnread: number;
  /** 对方（坐席）正在输入指示（P1 H2） */
  agentTyping: boolean;
  /** 转接通知：访客看到「正在为您转接至 XXX」 */
  transferNotice: string | null;
}

/**
 * 消息流与已读回执（从 ChatWidget 拆出，行为不变）：
 * socket 业务事件注册、已读标记（延迟 + 可见性）、HTTP 对账轮询（push+pull 双模型）
 * 与未读/输入中/转接通知等瞬态。
 */
export function useChatMessages({
  open,
  openRef,
  connected,
  room,
  isClosed,
  on,
  off,
  markRead,
  applyPresenceSignal,
  roomIdRef,
  clientEmailRef,
  pendingOutgoingRef,
  restartWithMessageRef,
  setMessages,
  setRoom,
  onAgentMessageWhileClosed,
}: UseChatMessagesOptions): UseChatMessagesResult {
  const [unreadCount, setUnreadCount] = useState(0);
  // 服务端未读聚合（P2 M1）：独立于本地 unreadCount（本地仅驱动气泡），
  // 由 notification-counts(-updated) 驱动，刷新/重连后仍准确。
  const [serverUnread, setServerUnread] = useState(0);
  // 对方（坐席）正在输入指示（P1 H2）
  const [agentTyping, setAgentTyping] = useState(false);
  // 转接通知（业内最佳实践：访客看到“正在为您转接至 XXX”）
  const [transferNotice, setTransferNotice] = useState<string | null>(null);
  const transferNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const agentTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 注册 socket 业务事件
  useEffect(() => {
    const handleNewMessage = (data: { message?: ChatMessage; room?: { roomId: string } }) => {
      const msg = data?.message;
      const rid = data?.room?.roomId;
      if (!msg || rid !== roomIdRef.current) return;
      // 自己的消息成功回声 → 落库确认，清除待重发标记（避免后续无关错误误触发重发）。
      if (msg.sender === 'client') pendingOutgoingRef.current = null;
      setMessages((prev) =>
        prev.some((m) => m.messageId === msg.messageId) ? prev : [...prev, normalizeMessage(msg)],
      );
      // 面板未打开 + 收到客服消息 → 累加未读数，并弹出预览气泡
      if (!openRef.current && msg.sender === 'agent') {
        setUnreadCount((n) => n + 1);
        onAgentMessageWhileClosed();
      }
      // 面板已打开 + 页面可见 + 收到客服消息 → 实时上报「已读」，驱动 B 端已读回执刷新
      // 切换桌面/标签页时 document.hidden=true，不标记已读（防止"假已读"）
      if (openRef.current && msg.sender === 'agent' && clientEmailRef.current && !document.hidden) {
        markRead(rid);
        setUnreadCount(0);
      }
    };

    const handleMessagesRead = (data: {
      userType?: string;
      roomId?: string;
      userEmail?: string;
      messageIds?: string[];
    }) => {
      if (data.userType !== 'agent' || data.roomId !== roomIdRef.current) return;
      const idSet = Array.isArray(data.messageIds) ? new Set(data.messageIds) : null;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.sender !== 'client') return m;
          if (idSet && !idSet.has(m.messageId)) return m;
          const hasAgent = (m.readBy ?? []).some((r) => r.userType === 'agent');
          if (hasAgent) return m;
          return {
            ...m,
            readBy: [
              ...(m.readBy ?? []),
              {
                userEmail: data.userEmail ?? '',
                userType: 'agent' as const,
                readAt: new Date().toISOString(),
              },
            ],
          };
        }),
      );
    };

    // presence-changed：关注对方（agent）的状态（明细信号入口，聚合逻辑在 useAgentPresence）
    const handlePresence = (data: {
      userEmail?: string;
      userType?: string;
      status?: AgentPresenceStatus;
    }) => {
      if (data.userType === 'agent' && data.status) {
        applyPresenceSignal(data.status);
      }
    };

    // 房间状态变更（坐席关闭 / 归档等）：实时同步到访客端，
    // 使「本次会话已结束」面板即时出现（含禁用输入框 + 重新发起咨询入口），
    // 而非要等刷新才看到关闭态 —— 否则客户会在已关闭会话里继续发消息却石沉大海。
    const handleRoomStatusChanged = (data: { roomId?: string; status?: string }) => {
      if (data.roomId !== roomIdRef.current) return;
      if (data.status) {
        setRoom((prev) => (prev ? { ...prev, status: data.status as ChatRoom['status'] } : prev));
      }
    };

    // 发送失败：
    //  - ROOM_ARCHIVED（会话已归档冷存）：把刚才那条消息承接到「新会话」发出，
    //    B 端队列据此重开新对话，杜绝访客消息石沉大海（业内最佳实践 Zendesk/Intercom）。
    //  - 其它错误（如会话已关闭，后端拒绝落库）：重新拉取房间，让前端状态与服务端一致
    //    （已关闭则展示结束面板），避免消息无声丢失。
    const handleError = (data?: { message?: string; code?: string; roomId?: string }) => {
      const rid = roomIdRef.current;
      const email = clientEmailRef.current;
      if (!data || typeof data !== 'object') return;
      if (data.code === 'ROOM_ARCHIVED') {
        const pending = pendingOutgoingRef.current;
        pendingOutgoingRef.current = null;
        if (pending) {
          restartWithMessageRef.current?.(pending.content, pending.attachments);
        } else if (rid && email) {
          // 无待发内容（如附件已入库）：同步房间状态，让前端进入归档→新对话引导态。
          getRoom(rid, email)
            .then((r) => {
              if (r && r.roomId === roomIdRef.current) setRoom(r);
            })
            .catch(() => {});
        }
        return;
      }
      if (!rid || !email || !('message' in data)) return;
      getRoom(rid, email)
        .then((r) => {
          if (r && r.roomId === roomIdRef.current) setRoom(r);
        })
        .catch(() => {});
    };

    // 对方（坐席）正在输入（P1 H2）：显示「对方正在输入…」，4s 无新信号自动消失
    const handleTyping = (data: { roomId?: string; userType?: string }) => {
      if (data.userType !== 'agent' || data.roomId !== roomIdRef.current) return;
      setAgentTyping(true);
      if (agentTypingTimer.current) clearTimeout(agentTypingTimer.current);
      agentTypingTimer.current = setTimeout(() => setAgentTyping(false), 4000);
    };
    const handleStopTyping = (data: { roomId?: string; userType?: string }) => {
      if (data.userType !== 'agent' || data.roomId !== roomIdRef.current) return;
      setAgentTyping(false);
      if (agentTypingTimer.current) clearTimeout(agentTypingTimer.current);
    };

    // 未读聚合计数（P2 M1）：初始拉取 + 增量更新
    const handleNotifCounts = (data: { totalUnread?: number }) => {
      setServerUnread(typeof data.totalUnread === 'number' ? data.totalUnread : 0);
    };

    // 转接通知（业内最佳实践：访客看到“正在为您转接至 XXX”，8s 后自动消失）
    const handleTransferNotice = (data: { roomId?: string; toAgentName?: string }) => {
      if (data.roomId !== roomIdRef.current) return;
      setTransferNotice(data.toAgentName || null);
      if (transferNoticeTimer.current) clearTimeout(transferNoticeTimer.current);
      transferNoticeTimer.current = setTimeout(() => setTransferNotice(null), 8000);
    };

    on('new-message', handleNewMessage);
    on('messages-read', handleMessagesRead);
    on('presence-changed', handlePresence);
    on('room-status-changed', handleRoomStatusChanged);
    on('room-transfer-notice', handleTransferNotice);
    on('typing', handleTyping);
    on('stop-typing', handleStopTyping);
    on('notification-counts-updated', handleNotifCounts);
    on('notification-counts', handleNotifCounts);
    on('error', handleError);
    return () => {
      off('new-message');
      off('messages-read');
      off('presence-changed');
      off('room-status-changed');
      off('room-transfer-notice');
      off('typing');
      off('stop-typing');
      off('notification-counts-updated');
      off('notification-counts');
      off('error');
      if (agentTypingTimer.current) clearTimeout(agentTypingTimer.current);
      if (transferNoticeTimer.current) clearTimeout(transferNoticeTimer.current);
    };
  }, [
    on,
    off,
    markRead,
    applyPresenceSignal,
    onAgentMessageWhileClosed,
    openRef,
    roomIdRef,
    clientEmailRef,
    pendingOutgoingRef,
    restartWithMessageRef,
    setMessages,
    setRoom,
  ]);

  // 标记已读：延迟 2 秒 + 页面可见时才触发，避免「秒开秒关」或「切换桌面」也被标记为已读。
  // 用户在面板停留超过 2 秒且页面可见才视为真正阅读；期间收到新客服消息仍会实时标记（handleNewMessage）。
  useEffect(() => {
    if (!open || !room || isClosed || !connected) return;
    const timer = setTimeout(() => {
      if (!document.hidden) {
        markRead(room.roomId);
        setUnreadCount(0);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [open, room, isClosed, connected, markRead]);

  // 页面从隐藏恢复可见时，自动标记当前会话已读（用户回来看了）
  useEffect(() => {
    if (!open || !room || isClosed || !connected) return;
    const onVisibilityChange = () => {
      if (!document.hidden) {
        markRead(room.roomId);
        setUnreadCount(0);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [open, room, isClosed, connected, markRead]);

  // 安全网（push+pull 双模型）：定时 HTTP 同步当前会话消息。
  // socket 推送保证实时性，HTTP 拉取保证正确性——丢失的 new-message 回声
  // （自己发的消息不显示、客服消息延迟）在 5s 内自愈。
  const roomIdForSync = room?.roomId ?? null;
  useEffect(() => {
    if (!roomIdForSync) return;
    const rid = roomIdForSync;
    const syncMessages = () => {
      const email = clientEmailRef.current;
      if (!email) return;
      getRoom(rid, email)
        .then((r) => {
          if (r.roomId !== roomIdRef.current) return;
          setMessages((prev) => {
            const serverMsgs = r.messages ?? [];
            // 快路径：本地消息数 >= 服务端 → 无新增，跳过
            if (prev.length >= serverMsgs.length) return prev;
            const map = new Map<string, ChatMessage>();
            for (const m of prev) map.set(m.messageId, m);
            for (const m of serverMsgs) map.set(m.messageId, normalizeMessage(m));
            return Array.from(map.values()).sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
            );
          });
        })
        .catch(() => {});
    };
    // 标签页隐藏时暂停轮询（避免后台空转），回到前台立即同步一次再恢复
    let timer: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (timer) return;
      timer = setInterval(syncMessages, 5000);
    };
    const stopPolling = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    if (!document.hidden) startPolling();
    const onVis = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        syncMessages();
        startPolling();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [roomIdForSync, clientEmailRef, roomIdRef, setMessages]);

  // unreadCount 仅在内部驱动（面板打开/已读时清零）；预览气泡展示由 ChatWidget 负责，
  // 保留 state 以维持原有行为（后续接徽章展示时可直接返回）。
  void unreadCount;

  return { serverUnread, agentTyping, transferNotice };
}
