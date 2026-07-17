'use client';

import { ImagePreviewProvider, ScrollArea } from '@tzj/ui';
import { useCallback, useEffect, useRef } from 'react';
import type { ChatRoom } from '../types';
import type { OnlineAgent } from '../useChatSocket';
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
  /** 在线坐席花名册（P1 H3 转接目标） */
  onlineAgents?: OnlineAgent[];
  /** 当前坐席邮箱（用于转接列表排除自身） */
  currentAgentEmail?: string;
  /** 转接回调（P1 H3） */
  onTransfer?: (toAgentEmail: string) => void;
  /** 访客是否正在输入（P1 H2） */
  clientTyping?: boolean;
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
  onlineAgents = [],
  currentAgentEmail,
  onTransfer,
  clientTyping,
}: Props) {
  // 真正可滚动的元素是 Radix ScrollArea 的 Viewport（带 data-radix-scroll-area-viewport）。
  // @tzj/ui 的 ScrollArea 没有透出 viewport ref，所以从内容 div 用 closest() 反向找到。
  const viewportRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const setContentRef = useCallback((el: HTMLDivElement | null) => {
    contentRef.current = el;
    viewportRef.current = el
      ? (el.closest('[data-radix-scroll-area-viewport]') as HTMLElement | null)
      : null;
  }, []);

  // 记录切换会话的时间戳：1s 内的 messages 变化视为"初始加载"（瞬时），
  // 超过 1s 才走平滑——避免刚切换就被程序滚动锁住 1-2s
  const switchedAtRef = useRef(0);
  // 是否「贴底」：用户主动向上翻看历史时为 false，避免新消息把他强行拽回底部；
  // 贴底时才自动跟随最新消息。初始/切换会话默认贴底。
  const pinnedRef = useRef(true);
  // 待执行的 rAF 句柄，卸载/依赖变化时取消，避免泄漏与竞态
  const rafRef = useRef<number | null>(null);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    switchedAtRef.current = Date.now();
    pinnedRef.current = true;
  }, [room.roomId]);

  // 跟踪用户是否贴在底部（滚动事件里更新）
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onScroll = () => {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      pinnedRef.current = gap < 120;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [room.roomId]);

  // messages 变化（收/发消息）→ 若贴底则滚到底。
  // 用双 rAF 等新气泡完成布局后再测 scrollHeight，避免按旧高度滚动只到半路。
  useEffect(() => {
    const isInitialLoad = Date.now() - switchedAtRef.current < 1000;
    if (!isInitialLoad && !pinnedRef.current) return;
    const r1 = requestAnimationFrame(() => {
      const r2 = requestAnimationFrame(() => scrollToBottom(!isInitialLoad));
      rafRef.current = r2;
    });
    rafRef.current = r1;
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [room.roomId, room.messages, scrollToBottom]);

  // 内容高度异步变化（图片加载、Markdown 重排等）→ 若贴底则重新滚到底，
  // 修复「发/收消息后没有彻底滚动到底部」：图片撑高发生在首次滚动之后。
  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (pinnedRef.current) scrollToBottom(false);
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [room.roomId, scrollToBottom]);

  return (
    <div className="border-border/40 relative flex min-h-0 flex-col gap-3 overflow-hidden rounded-2xl border p-3 sm:gap-4 sm:p-4 lg:col-start-2 lg:col-end-3 lg:rounded-3xl">
      <div
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-background/80 backdrop-blur"
        aria-hidden
      />
      <ChatHeader
        room={room}
        onClose={onClose}
        onConverted={onConverted}
        onlineAgents={onlineAgents}
        currentAgentEmail={currentAgentEmail}
        onTransfer={onTransfer}
      />

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

      {/* 访客正在输入指示器（P1 H2） */}
      {clientTyping && room.status !== 'closed' && (
        <div className="px-3 pb-1" aria-live="polite">
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
            <span className="flex gap-0.5">
              <span className="bg-muted-foreground/60 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.2s]" />
              <span className="bg-muted-foreground/60 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.1s]" />
              <span className="bg-muted-foreground/60 h-1.5 w-1.5 animate-bounce rounded-full" />
            </span>
            访客正在输入…
          </span>
        </div>
      )}

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
