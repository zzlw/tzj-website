'use client';

/**
 * 单条消息（docs/lingxi-ai-report-design.md §7.2）：
 * user 右对齐气泡；assistant 全宽报告——折叠时间线 + 流式 Markdown + 数据溯源卡片。
 * Markdown 用 @tzj/ui 的 MarkdownBody（react-markdown + rehypeSanitize，覆盖 LLM 输出的
 * XSS 面），组件映射按 admin 运行时主题令牌覆盖（基础映射面向 web 的 neutral 色板）。
 */
import type { LingxiDataRefItem } from '@tzj/types';
import { Button, MarkdownBody, type MarkdownComponents } from '@tzj/ui';
import { CircleAlert, Database, RotateCcw } from 'lucide-react';
import type { LingxiUiMessage } from '@/hooks/useLingxiChat';
import { LingxiSuggests } from './LingxiSuggests';
import { LingxiTimeline } from './LingxiTimeline';

/** admin 主题令牌版 Markdown 映射：明暗模式与 theme-* 预设下均正确着色 */
const adminMarkdownComponents: MarkdownComponents = {
  h1: ({ children }) => (
    <h1 className="mt-8 text-xl font-bold text-foreground first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-7 text-lg font-bold text-foreground first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-6 text-base font-semibold text-foreground first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-5 text-sm font-semibold text-foreground first:mt-0">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="mt-3 text-sm leading-relaxed text-foreground/90 first:mt-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground/90 marker:text-primary first:mt-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-foreground/90 marker:font-semibold marker:text-foreground first:mt-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="[&>p]:mt-0 [&>p]:inline">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mt-4 border-l-4 border-primary pl-4 text-sm leading-relaxed text-muted-foreground first:mt-0">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  hr: () => <hr className="my-6 border-border" />,
  code: ({ className, children }) => (
    <code
      className={`rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground ${className ?? ''}`}
    >
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mt-4 overflow-x-auto rounded-md bg-muted p-3 text-xs first:mt-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="mt-4 overflow-x-auto first:mt-0">
      <table className="w-full min-w-[420px] border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-border px-3 py-1.5 text-left text-xs font-semibold text-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-3 py-1.5 text-xs text-foreground/90">{children}</td>
  ),
};

export function LingxiMessage({
  message,
  generating,
  onSuggest,
  onRetry,
}: {
  message: LingxiUiMessage;
  /** 全局是否有生成进行中（禁用 chips / 重试） */
  generating: boolean;
  onSuggest: (text: string) => void;
  onRetry: () => void;
}) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <LingxiTimeline items={message.timeline} streaming={message.streaming} />

      {message.content ? (
        <MarkdownBody content={message.content} components={adminMarkdownComponents} />
      ) : message.streaming ? (
        <span className="inline-block h-4 w-2 animate-pulse rounded-sm bg-primary/60" />
      ) : null}

      {message.error ? (
        <div className="mt-3 flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <CircleAlert className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 break-words">{message.error}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={generating}
            onClick={onRetry}
            className="shrink-0 gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            重试
          </Button>
        </div>
      ) : null}

      <DataRefCards items={message.dataRefs} />

      {!message.streaming && !message.error ? (
        <LingxiSuggests items={message.suggests} disabled={generating} onSelect={onSuggest} />
      ) : null}
    </div>
  );
}

/** 数据溯源卡片行：工具名 + 时间范围 + 行数，建立「报告数字可回查」的信任感 */
function DataRefCards({ items }: { items: LingxiDataRefItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {items.map((ref) => (
        <div
          key={`${ref.tool}-${ref.range}`}
          className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[11px] text-muted-foreground"
        >
          <Database className="size-3 text-primary" />
          <code className="font-mono">{ref.tool}</code>
          <span className="text-border">|</span>
          <span>{ref.range}</span>
          <span className="text-border">|</span>
          <span>{ref.rows} 行</span>
        </div>
      ))}
    </div>
  );
}
