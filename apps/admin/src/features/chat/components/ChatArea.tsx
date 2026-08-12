'use client';

import { ImagePreviewProvider, ScrollArea } from '@tzj/ui';
import { isSameChatDay } from '@tzj/utils';
import { ArrowDown } from 'lucide-react';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import type { ChatRoom } from '../types';
import type { OnlineAgent } from '../useChatSocket';
import { ChatDayDivider } from './ChatDayDivider';
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
  /** 在线坐席花名册（P1 H3 转接目标） */
  onlineAgents?: OnlineAgent[];
  /** 当前坐席邮箱（用于转接列表排除自身） */
  currentAgentEmail?: string;
  /** 转接回调（P1 H3，含备注） */
  onTransfer?: (toAgentEmail: string, note?: string) => void;
  /** 访客是否正在输入（P1 H2） */
  clientTyping?: boolean;
  /** 访客实时输入内容预览（业内最佳实践 LiveChat/Tawk.to） */
  clientTypingText?: string;
  /** 搜索跳转的目标消息 id：进入会话后滚动定位并瞬时高亮 */
  highlightMessageId?: string | null;
  /** 是否有删除权限（chat.delete），透传给 ChatHeader 的「更多操作」菜单 */
  canDelete?: boolean;
  /** 是否可永久删除（仅管理员） */
  canPurge?: boolean;
  /** 移入回收站 */
  onDelete?: () => void;
  /** 从回收站恢复 */
  onRestore?: () => void;
  /** 永久删除 */
  onPurge?: () => void;
}

export function ChatArea({
  room,
  draft,
  onDraftChange,
  onSend,
  onClose,
  quickReplies,
  onQuickReply,
  onlineAgents = [],
  currentAgentEmail,
  onTransfer,
  clientTyping,
  clientTypingText,
  highlightMessageId,
  canDelete,
  canPurge,
  onDelete,
  onRestore,
  onPurge,
}: Props) {
  // 真正可滚动的元素是 ScrollArea 的 Viewport（带 data-slot="scroll-area-viewport"）。
  // @tzj/ui 的 ScrollArea 没有透出 viewport ref，所以从内容 div 用 closest() 反向找到。
  const viewportRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const setContentRef = useCallback((el: HTMLDivElement | null) => {
    contentRef.current = el;
    viewportRef.current = el
      ? (el.closest('[data-slot="scroll-area-viewport"]') as HTMLElement | null)
      : null;
  }, []);

  // 记录切换会话的时间戳：1s 内的 messages 变化视为"初始加载"（瞬时），
  // 超过 1s 才走平滑——避免刚切换就被程序滚动锁住 1-2s
  const switchedAtRef = useRef(0);
  // 是否「贴底」：用户主动向上翻看历史时为 false，避免新消息把他强行拽回底部；
  // 贴底时才自动跟随最新消息。初始/切换会话默认贴底。
  const pinnedRef = useRef(true);
  // 「↓ 新消息」浮动按钮计数（业内最佳实践 WhatsApp/Intercom/Telegram）
  const [newMsgCount, setNewMsgCount] = useState(0);
  // 搜索跳转命中的消息瞬时高亮（自身管理生命周期：定位后点亮，约 2s 后淡出）
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 已完成跳转的目标 id：防止 room.messages 后续变化（如新消息到达）时重复把视口拽回旧命中
  const lastJumpedRef = useRef<string | null>(null);
  // 待执行的 rAF 句柄，卸载/依赖变化时取消，避免泄漏与竞态
  const rafRef = useRef<number | null>(null);

  // 首次点开会话 → 请求浏览器通知权限（手势触发，符合浏览器策略）
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted' || Notification.permission === 'denied') return;

    void Notification.requestPermission().catch(() => {
      // 静默失败（可能被浏览器拦截）
    });
  }, [room.roomId]);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // 「仅查看」：会话已有负责人且不是当前坐席——与服务端 send-message 归属校验一致，
  // 非负责人只能只读查看，不能直接对客回复（避免双人抢答）。
  const notMyRoom = !!room.assignedAgentEmail && room.assignedAgentEmail !== currentAgentEmail;

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
      pinnedRef.current = gap < 150;
      // 用户滚回底部 → 清除「新消息」计数
      if (pinnedRef.current) setNewMsgCount(0);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [room.roomId]);

  // messages 变化（收/发消息）→ 若贴底则滚到底；否则累加「新消息」计数。
  // 用双 rAF 等新气泡完成布局后再测 scrollHeight，避免按旧高度滚动只到半路。
  const prevMsgLenRef = useRef(0);
  useEffect(() => {
    const isInitialLoad = Date.now() - switchedAtRef.current < 1000;
    const msgLen = room.messages?.length ?? 0;
    const isNew = msgLen > prevMsgLenRef.current;
    prevMsgLenRef.current = msgLen;
    if (isInitialLoad) {
      // 初始加载：直接滚底
      const r1 = requestAnimationFrame(() => {
        const r2 = requestAnimationFrame(() => scrollToBottom(false));
        rafRef.current = r2;
      });
      rafRef.current = r1;
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }
    if (!isNew) return;
    if (pinnedRef.current) {
      const r1 = requestAnimationFrame(() => {
        const r2 = requestAnimationFrame(() => scrollToBottom(true));
        rafRef.current = r2;
      });
      rafRef.current = r1;
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }
    // 用户翻历史时收到新消息 → 累加「新消息」计数
    setNewMsgCount((n) => n + 1);
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

  // 搜索跳转：进入会话（或同会话内命中变化）后，滚动定位到目标消息并瞬时高亮。
  // 不贴底（pinnedRef=false），避免初始加载/ResizeObserver 把视口重新拽回底部。
  useEffect(() => {
    if (!highlightMessageId) return;
    if (lastJumpedRef.current === highlightMessageId) return;
    if (!(room.messages ?? []).some((m) => m.messageId === highlightMessageId)) return;
    lastJumpedRef.current = highlightMessageId;
    pinnedRef.current = false;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = contentRef.current?.querySelector<HTMLElement>(
          `[data-message-id="${CSS.escape(highlightMessageId)}"]`,
        );
        el?.scrollIntoView({ block: 'center', behavior: 'auto' });
        setFlashId(highlightMessageId);
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => setFlashId(null), 2200);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [highlightMessageId, room.messages]);

  // 卸载时清理高亮计时器，避免对已卸载组件 setState
  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  return (
    <div className="border-border/40 relative flex min-h-0 flex-col gap-3 overflow-hidden rounded-2xl border p-3 sm:gap-4 sm:p-4 lg:col-start-2 lg:col-end-3 lg:rounded-3xl">
      <div
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-background/80 backdrop-blur"
        aria-hidden
      />
      <ChatHeader
        room={room}
        onClose={onClose}
        onlineAgents={onlineAgents}
        currentAgentEmail={currentAgentEmail}
        onTransfer={onTransfer}
        canDelete={canDelete}
        canPurge={canPurge}
        onDelete={onDelete}
        onRestore={onRestore}
        onPurge={onPurge}
      />

      {/* 消息滚动区 + 「↓ 新消息」浮动按钮
          业内最佳实践（WhatsApp/Telegram/Intercom）：pill 锚定在消息视口底缘，
          浮于消息内容之上，与 composer 高度完全解耦。 */}
      <div className="relative min-h-0 flex-1">
        <ImagePreviewProvider>
          <ScrollArea
            type="always"
            className="h-full [&>[data-slot=scroll-area-viewport]]:overscroll-contain"
          >
            <div ref={setContentRef} className="space-y-3 overflow-x-hidden pb-3 pr-3 sm:space-y-4">
              {room.messages?.length === 0 ? (
                <p className="text-muted-foreground py-10 text-center text-sm">尚未有消息</p>
              ) : (
                (room.messages ?? []).map((m, i, all) => {
                  const prev = all[i - 1];
                  // 跨自然日插入日期分隔胶囊，气泡内只保留 HH:mm（与 C 端一致）
                  const showDayDivider = !prev || !isSameChatDay(prev.timestamp, m.timestamp);
                  return (
                    <Fragment key={m.messageId}>
                      {showDayDivider && <ChatDayDivider timestamp={m.timestamp} />}
                      <ChatMessageBubble message={m} highlighted={m.messageId === flashId} />
                    </Fragment>
                  );
                })
              )}
              {/* 访客正在输入指示器（业内最佳实践 LiveChat/Tawk.to）
                  有预览文本 → 「草稿消息」气泡（淡化+斜体 = 未发送语义）+ 底部小圆点
                  无预览文本 → 标准圆点气泡（Intercom 风格） */}
              {clientTyping && room.status !== 'closed' && room.status !== 'archived' && (
                <div className="flex flex-col items-start" aria-live="polite">
                  {clientTypingText ? (
                    <div className="bg-muted/50 max-w-[80%] rounded-2xl px-3.5 py-2.5">
                      <p className="text-muted-foreground text-sm italic leading-relaxed break-words whitespace-pre-wrap">
                        {clientTypingText}
                      </p>
                      <span className="mt-1.5 flex items-center justify-end gap-[3px]">
                        <span className="bg-muted-foreground/40 h-1 w-1 animate-bounce rounded-full [animation-delay:-0.2s]" />
                        <span className="bg-muted-foreground/40 h-1 w-1 animate-bounce rounded-full [animation-delay:-0.1s]" />
                        <span className="bg-muted-foreground/40 h-1 w-1 animate-bounce rounded-full" />
                      </span>
                    </div>
                  ) : (
                    <div className="bg-muted/50 inline-flex items-center gap-1 rounded-2xl px-4 py-3">
                      <span className="bg-muted-foreground/50 h-2 w-2 animate-bounce rounded-full [animation-delay:-0.3s]" />
                      <span className="bg-muted-foreground/50 h-2 w-2 animate-bounce rounded-full [animation-delay:-0.15s]" />
                      <span className="bg-muted-foreground/50 h-2 w-2 animate-bounce rounded-full" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </ImagePreviewProvider>

        {/* 「↓ N 条新消息」pill：用户翻阅历史时收到新消息才出现，
            点击 → 平滑滚底 + 清零；手动滚回底部也会自动消失 */}
        {newMsgCount > 0 && (
          <button
            type="button"
            onClick={() => {
              scrollToBottom(true);
              setNewMsgCount(0);
            }}
            className="bg-primary text-primary-foreground shadow-lg absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all hover:opacity-90 hover:shadow-xl active:scale-95"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            {newMsgCount} 条新消息
          </button>
        )}
      </div>

      <ChatMessageComposer
        draft={draft}
        onDraftChange={onDraftChange}
        onSend={onSend}
        contactName={room.clientName || room.clientEmail}
        quickReplies={quickReplies}
        onQuickReply={onQuickReply}
        disabled={
          !!room.deletedAt || room.status === 'closed' || room.status === 'archived' || notMyRoom
        }
        disabledHint={
          room.deletedAt
            ? '会话已在回收站，仅可查看；如需继续请先恢复会话'
            : room.status === 'archived'
              ? '会话已归档，无法继续发送'
              : notMyRoom
                ? '该会话由其他坐席负责 · 仅查看，如需回复请先转接或认领'
                : undefined
        }
      />
    </div>
  );
}
