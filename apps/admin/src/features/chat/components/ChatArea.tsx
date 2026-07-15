'use client';

import { ImagePreviewProvider, ScrollArea } from '@tzj/ui';
import { useCallback, useEffect, useRef } from 'react';
import type { ChatRoom } from '../types';
import { ChatHeader } from './ChatHeader';
import { ChatMessageBubble } from './ChatMessageBubble';
import { ChatMessageComposer } from './ChatMessageComposer';

interface Props {
  room: ChatRoom;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
  quickReplies: string[];
  onQuickReply: (text: string) => void;
  onConverted?: (customerId: string) => void;
}

export function ChatArea({
  room,
  draft,
  onDraftChange,
  onSend,
  onClose,
  quickReplies,
  onQuickReply,
  onConverted,
}: Props) {
  // 真正可滚动的元素是 Radix ScrollArea 的 Viewport（带 data-radix-scroll-area-viewport）。
  // @tzj/ui 的 ScrollArea 没有透出 viewport ref，所以从内容 div 用 closest() 反向找到。
  const viewportRef = useRef<HTMLElement | null>(null);
  const setContentRef = useCallback((el: HTMLDivElement | null) => {
    viewportRef.current = el
      ? (el.closest('[data-radix-scroll-area-viewport]') as HTMLElement | null)
      : null;
  }, []);

  // 记录切换会话的时间戳：1s 内的 messages 变化视为"初始加载"（瞬时），
  // 超过 1s 才走平滑——避免刚切换就被程序滚动锁住 1-2s
  const switchedAtRef = useRef(0);

  useEffect(() => {
    switchedAtRef.current = Date.now();
  }, [room.roomId]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const isInitialLoad = Date.now() - switchedAtRef.current < 1000;
    requestAnimationFrame(() => {
      const el = viewportRef.current;
      if (!el) return;
      const top = el.scrollHeight;
      if (isInitialLoad) {
        el.scrollTop = top;
      } else {
        el.scrollTo({ top, behavior: 'smooth' });
      }
    });
  }, [room.roomId, room.messages]);

  return (
    <div className="border-border/40 relative flex min-h-0 flex-col gap-3 overflow-hidden rounded-2xl border p-3 sm:gap-4 sm:p-4 lg:col-start-2 lg:col-end-3 lg:rounded-3xl">
      <div
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-background/80 backdrop-blur"
        aria-hidden
      />
      <ChatHeader room={room} onClose={onClose} onConverted={onConverted} />

      <ImagePreviewProvider>
        <ScrollArea type="always" className="min-h-0 flex-1">
          <div ref={setContentRef} className="space-y-3 pb-3 pr-3 sm:space-y-4">
            {room.messages?.length === 0 ? (
              <p className="text-muted-foreground py-10 text-center text-sm">尚未有消息</p>
            ) : (
              (room.messages ?? []).map((m) => <ChatMessageBubble key={m.messageId} message={m} />)
            )}
          </div>
        </ScrollArea>
      </ImagePreviewProvider>

      <ChatMessageComposer
        draft={draft}
        onDraftChange={onDraftChange}
        onSend={onSend}
        contactName={room.clientName || room.clientEmail}
        quickReplies={quickReplies}
        onQuickReply={onQuickReply}
        disabled={room.status === 'closed'}
      />
    </div>
  );
}
