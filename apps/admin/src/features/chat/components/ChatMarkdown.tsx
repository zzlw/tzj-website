'use client';

import { MarkdownPreview } from '@tzj/ui';

/**
 * 聊天气泡内联 Markdown 渲染（B 端客服视角）。
 * 复用 @tzj/ui 的 MarkdownPreview（Vditor.preview，chat 变体），
 * 与 C 端（web）共用同一渲染引擎，保证两端一致。
 */
export function ChatMarkdown({ content, className }: { content: string; className?: string }) {
  return <MarkdownPreview markdown={content} variant="chat" className={className} />;
}
