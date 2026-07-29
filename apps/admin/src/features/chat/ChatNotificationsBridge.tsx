'use client';

import { toast } from '@tzj/ui';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { useChatPresence } from './ChatPresenceProvider';
import type { ChatMessage, ChatRoom } from './types';
import { useOpenChatRoom } from './use-open-chat-room';

interface NewMessagePayload {
  message: ChatMessage;
  room: Partial<ChatRoom & { assignedAgentEmail?: string | null }>;
}

interface AgentNotificationCounts {
  totalUnread: number;
  myUnread?: number;
  unassignedUnread?: number;
  othersUnread?: number;
}

/** 同会话 3 秒 per-room 节流窗口（§4.2.3 规则 4：toast 合并之外的兜底） */
const ROOM_THROTTLE_MS = 3000;
/** 全局提示音 3 秒节流窗口（§4.2.5：独立的全局单值时间戳，与 per-room 口径分开维护） */
const AUDIO_THROTTLE_MS = 3000;

/** 音频单例（避免重复创建）；双源按浏览器能力选择（§4.2.5） */
let audioInstance: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (!audioInstance) {
    const probe = document.createElement('audio');
    const src = probe.canPlayType('audio/webm; codecs="opus"')
      ? '/sounds/notify.webm'
      : '/sounds/notify.mp3';
    audioInstance = new Audio(src);
    audioInstance.volume = 0.5;
  }
  return audioInstance;
}

/** 播放提示音（全局 3 秒节流；首次用户交互前自动播放失败静默吞掉） */
let lastPlayTime = 0;
function playNotificationSound() {
  const now = Date.now();
  if (now - lastPlayTime < AUDIO_THROTTLE_MS) return;
  lastPlayTime = now;
  const audio = getAudio();
  audio.currentTime = 0;
  audio.play().catch(() => {
    // 浏览器自动播放策略拦截，静默降级
  });
}

/** 生成消息摘要（截断 60 字符，附件显示 [图片]/[文件]） */
function formatMessageSnippet(message: ChatMessage): string {
  let snippet = message.content || '';
  if (message.attachments?.length) {
    const attachmentLabels = message.attachments.map((attachment) =>
      attachment.contentType?.startsWith('image/') ? '[图片]' : '[文件]',
    );
    snippet = `${snippet}${snippet ? ' · ' : ''}(${attachmentLabels.join(', ')})`;
  }
  if (snippet.length > 60) {
    snippet = `${snippet.slice(0, 59)}…`;
  }
  return snippet;
}

/**
 * 弹出/抑制规则（§4.2.3，按顺序判断，命中任一条则不弹）：
 * 1. 非客户消息；2. 会话归属他人；3. 正在 /chat 查看该会话且页面可见。
 * 规则 4（per-room 3s 节流）由调用方的时间戳 Map 承接。
 * 「当前选中会话」在事件时刻同步读 URL ?room=（chat 页经 replaceState 即时同步，
 * window.location 永远新鲜，无需监听 history 事件）。
 */
function shouldShowToast(
  payload: NewMessagePayload,
  agentEmail: string,
  currentPathname: string,
): boolean {
  const { message, room } = payload;

  // 1. 仅客户消息才通知
  if (message.sender !== 'client') return false;

  // 2. 会话归属他人则不通知（与未读口径一致）
  if (room.assignedAgentEmail && room.assignedAgentEmail !== agentEmail) return false;

  // 3. 当前在 /chat 页且该会话正被选中且页面可见（聊天区自身有实时渲染）
  if (
    currentPathname === '/chat' &&
    document.visibilityState === 'visible' &&
    new URLSearchParams(window.location.search).get('room') === room.roomId
  ) {
    return false;
  }

  return true;
}

/** 浏览器系统通知（§4.2.6）：仅标签页在后台时触发；不在此处索权（授权绑定 /chat 页手势） */
function showBrowserNotification(payload: NewMessagePayload, openRoom: (roomId: string) => void) {
  if (document.visibilityState !== 'hidden') return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  const { message, room } = payload;
  const roomId = room.roomId as string;

  const notification = new Notification(`${room.clientName || room.clientEmail}`, {
    body: formatMessageSnippet(message),
    tag: roomId, // 同会话自动替换不堆叠
    icon: '/favicon.ico',
  });

  notification.onclick = () => {
    window.focus();
    openRoom(roomId);
  };
}

/**
 * 全局消息通知桥（§4.2.1）：挂在 ChatPresenceProvider 内，无 UI。
 * 1. 监听 notification-counts / notification-counts-updated → actionableUnread（Sidebar 徽标）
 * 2. 监听 new-message → 抑制规则判定后弹 toast.chatMessage 卡片
 * 3. 提示音（§4.2.5）/ 浏览器系统通知（§4.2.6）
 */
export function ChatNotificationsBridge({ children }: { children: React.ReactNode }) {
  const { socket, agentEmail, setActionableUnread } = useChatPresence();

  // pathname 存 ref：事件回调里同步读取，避免闭包陈旧（usePathname 不含 basePath，可靠对比 '/chat'）
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  /** per-room 节流时间戳 Map（§4.2.3 规则 4，独立于全局音频节流） */
  const roomThrottleLastBump = useRef<Map<string, number>>(new Map());

  /** 跳转到会话（已抽为共享 hook，与通知弹层共用） */
  const openRoom = useOpenChatRoom();

  /** 未读计数 → actionableUnread（§4.2.1：myUnread + unassignedUnread） */
  const handleNotifCounts = useCallback(
    (payload: AgentNotificationCounts) => {
      setActionableUnread((payload.myUnread ?? 0) + (payload.unassignedUnread ?? 0));
    },
    [setActionableUnread],
  );

  /** new-message → 弹 toast / 提示音 / 系统通知 */
  const handleNewMessage = useCallback(
    (payload: NewMessagePayload) => {
      const roomId = payload.room.roomId as string;
      if (!roomId) return;

      // 规则 1-3（§4.2.3）
      if (!shouldShowToast(payload, agentEmail, pathnameRef.current)) return;

      // 规则 4：同会话 3 秒内已弹过 → 不弹（per-room 时间戳 Map）
      const now = Date.now();
      const lastBump = roomThrottleLastBump.current.get(roomId);
      if (lastBump && now - lastBump < ROOM_THROTTLE_MS) return;
      roomThrottleLastBump.current.set(roomId, now);

      // toast 卡片（§4.2.2：同会话合并计数由 toast.chatMessage 内部 upsert 承接）
      toast.chatMessage({
        roomId,
        clientName: payload.room.clientName || '',
        clientEmail: payload.room.clientEmail || '',
        snippet: formatMessageSnippet(payload.message),
        onOpen: () => openRoom(roomId),
      });

      // 提示音（§4.2.5）+ 系统通知（§4.2.6，仅后台）
      playNotificationSound();
      showBrowserNotification(payload, openRoom);
    },
    [agentEmail, openRoom],
  );

  // 初值 + 增量共用同一处理（§4.2.1：useChatSocket 连接后自动 get-notification-counts，
  // Bridge 挂载即注册监听保证不丢初值）
  useEffect(() => {
    const unsubInitial = socket.on('notification-counts', handleNotifCounts);
    const unsubUpdated = socket.on('notification-counts-updated', handleNotifCounts);
    const unsubMessage = socket.on('new-message', handleNewMessage);
    return () => {
      unsubInitial();
      unsubUpdated();
      unsubMessage();
    };
  }, [socket, handleNotifCounts, handleNewMessage]);

  return <>{children}</>;
}
