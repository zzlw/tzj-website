'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useRef } from 'react';

/** ChatMessenger 同页切换会话的自定义事件（replaceState 不同步 useSearchParams，经事件直达） */
export const CHAT_OPEN_ROOM_EVENT = 'tzj:chat-open-room';

/**
 * 跳转到会话（ChatNotificationsBridge 与通知弹层共用）：
 * - 已在 /chat 页：replaceState 同步 URL + 派发 CHAT_OPEN_ROOM_EVENT（ChatMessenger 已监听）
 * - 其他页：router.push('/chat?room=xxx')，ChatMessenger 挂载后经 roomParam 自动选中
 */
export function useOpenChatRoom(): (roomId: string) => void {
  const router = useRouter();

  // pathname 存 ref：事件回调里同步读取，避免闭包陈旧（usePathname 不含 basePath，可靠对比 '/chat'）
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  return useCallback(
    (roomId: string) => {
      if (pathnameRef.current === '/chat') {
        const url = new URL(window.location.href);
        url.searchParams.set('room', roomId);
        window.history.replaceState(null, '', url.toString());
        window.dispatchEvent(new CustomEvent(CHAT_OPEN_ROOM_EVENT, { detail: { roomId } }));
      } else {
        router.push(`/chat?room=${encodeURIComponent(roomId)}`);
      }
    },
    [router],
  );
}
