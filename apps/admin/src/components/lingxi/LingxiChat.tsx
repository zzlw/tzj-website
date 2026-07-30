'use client';

/**
 * 灵犀主容器（docs/lingxi-ai-report-design.md §7）：
 * 会话侧列 + 消息列表 + 输入区，SSE 状态机由 useLingxiChat 承载。
 * 高度基于 DashboardShell 的滚动容器铺满视口，内部各自滚动。
 */
import type { LingxiStage } from '@tzj/types';
import { Button, ScrollArea, Textarea } from '@tzj/ui';
import { Loader2, SendHorizontal } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLingxiChat } from '@/hooks/useLingxiChat';
import { LingxiConversationList } from './LingxiConversationList';
import { LingxiEmptyState } from './LingxiEmptyState';
import { LingxiMessage } from './LingxiMessage';

const STAGE_LABELS: Record<LingxiStage, string> = {
  accepted: '已接收',
  planning: '正在规划分析…',
  fetching: '正在拉取数据…',
  generating: '正在撰写报告…',
};

export function LingxiChat() {
  const {
    conversationId,
    messages,
    stage,
    generating,
    loadingHistory,
    send,
    retry,
    openConversation,
    reset,
  } = useLingxiChat();

  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // 新帧到达时跟随滚动到底部（流式生成中报告不断变长）
  // biome-ignore lint/correctness/useExhaustiveDependencies: messages 变化即触发滚动
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const submit = useCallback(() => {
    const text = input.trim();
    if (!text || generating) return;
    setInput('');
    send(text);
  }, [input, generating, send]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter 发送、Shift+Enter 换行；输入法组合中不触发
      if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
        event.preventDefault();
        submit();
      }
    },
    [submit],
  );

  return (
    <div className="flex h-[calc(100svh-8.5rem)] min-h-[480px] overflow-hidden rounded-lg border border-border bg-background">
      <div className="hidden md:block">
        <LingxiConversationList
          activeId={conversationId}
          generating={generating}
          onSelect={openConversation}
          onNew={reset}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
            {loadingHistory ? (
              <div className="flex justify-center py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <LingxiEmptyState disabled={generating} onSelect={send} />
            ) : (
              <div className="space-y-6">
                {messages.map((message) => (
                  <LingxiMessage
                    key={message.id}
                    message={message}
                    generating={generating}
                    onSuggest={send}
                    onRetry={retry}
                  />
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="border-t border-border p-4">
          <div className="mx-auto w-full max-w-3xl">
            {generating && stage ? (
              <p className="mb-2 flex items-center gap-1.5 text-xs text-primary">
                <Loader2 className="size-3.5 animate-spin" />
                {STAGE_LABELS[stage]}
              </p>
            ) : null}
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="问问投放数据，如：近两周整体投放表现如何？（Enter 发送，Shift+Enter 换行）"
                rows={2}
                disabled={generating}
                className="max-h-40 min-h-[3.5rem] flex-1 resize-none"
              />
              <Button
                size="icon"
                aria-label="发送"
                disabled={generating || input.trim().length === 0}
                onClick={submit}
              >
                {generating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <SendHorizontal className="size-4" />
                )}
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              报告由 AI 基于站内聚合数据生成，仅注入聚合统计、不含访客个人信息；结论仅供参考。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
