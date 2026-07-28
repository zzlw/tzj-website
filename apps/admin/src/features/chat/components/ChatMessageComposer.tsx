'use client';

import { Button } from '@tzj/ui';
import { Send } from 'lucide-react';
import { type MouseEvent as ReactMouseEvent, useRef, useState } from 'react';
import { MarkdownEditor } from '@/components/crud/MarkdownEditor';

interface Props {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  contactName?: string;
  disabled?: boolean;
  /** 禁用态提示文案（closed=已结束 / archived=已归档） */
  disabledHint?: string;
  quickReplies?: string[];
  onQuickReply?: (text: string) => void;
}

export function ChatMessageComposer({
  draft,
  onDraftChange,
  onSend,
  contactName,
  disabled,
  disabledHint = '会话已结束，无法继续发送',
  quickReplies = [],
  onQuickReply,
}: Props) {
  const [editorHeight, setEditorHeight] = useState(140);
  const dragStart = useRef<{ y: number; h: number } | null>(null);

  // 顶部拖拽条：向上拖拽增大输入框高度（聊天面板在底部，向上生长更自然）
  const onResizeStart = (e: ReactMouseEvent) => {
    e.preventDefault();
    dragStart.current = { y: e.clientY, h: editorHeight };
    const onMove = (ev: MouseEvent) => {
      if (!dragStart.current) return;
      const next = dragStart.current.h + (dragStart.current.y - ev.clientY);
      setEditorHeight(Math.min(440, Math.max(120, next)));
    };
    const onUp = () => {
      dragStart.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.trim()) onSend();
      }}
      className="space-y-2 sm:space-y-3"
      aria-label="回复输入区"
    >
      <div className="border-border/40 relative flex items-center gap-2 rounded-2xl border p-3 sm:gap-3 sm:rounded-3xl sm:p-4">
        <div
          className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-background/80 backdrop-blur"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          {disabled ? (
            <div className="text-muted-foreground rounded-xl border border-dashed border-border/60 bg-muted/40 px-3 py-3 text-sm">
              {disabledHint}
            </div>
          ) : (
            // biome-ignore lint/a11y/noStaticElementInteractions: 快捷键委托容器（⌘/Ctrl+Enter 发送），焦点在内部 Vditor 编辑器
            <div
              className="chat-composer-editor"
              onKeyDown={(e) => {
                // Vditor 接管 Enter（换行）；用 ⌘/Ctrl + Enter 发送，贴合富文本编辑器习惯
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  if (draft.trim()) onSend();
                }
              }}
            >
              {/* biome-ignore lint/a11y/useFocusableInteractive: 鼠标拖拽手柄，无键盘等价操作，故意不可聚焦 */}
              <div
                role="separator"
                aria-orientation="horizontal"
                aria-valuenow={Math.round(editorHeight)}
                aria-label="拖动调整输入框高度"
                onMouseDown={onResizeStart}
                className="mb-1 flex h-3 w-full cursor-row-resize items-center justify-center"
              >
                <span className="block h-1 w-10 rounded-full bg-border/70 transition-colors hover:bg-primary/60" />
              </div>
              <MarkdownEditor
                value={draft}
                onChange={onDraftChange}
                minHeight={140}
                height={editorHeight}
                defaultMode="wysiwyg"
                placeholder="支持 Markdown / GFM（⌘/Ctrl + Enter 发送）"
              />
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1.5 sm:w-14 sm:gap-2">
          <Button
            type="submit"
            size="icon"
            disabled={disabled || !draft.trim()}
            aria-label="发送消息"
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/40 focus-visible:ring-offset-background size-8 rounded-full shadow-lg transition focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:size-10"
          >
            <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
      {quickReplies.length > 0 && !disabled && (
        <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
          {quickReplies.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onQuickReply?.(q)}
              className="border-border/50 bg-background/70 text-muted-foreground hover:border-primary/40 hover:text-foreground focus-visible:ring-primary/40 focus-visible:ring-offset-background rounded-full border px-2.5 py-0.5 text-xs transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:px-3 sm:py-1"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
