'use client';

import { MarkdownPreview } from '@tzj/ui';

/**
 * 聊天气泡内联 Markdown 渲染（C 端访客视角）。
 * 复用 @tzj/ui 的 MarkdownPreview（Vditor.preview，chat 变体），
 * 与 B 端（admin）共用同一渲染引擎，保证客服发出的内容两端一致渲染。
 * 样式收敛在 globals.css 的 `.chat-md-reset`，贴合气泡。
 */
export function ChatMarkdown({ content, className }: { content: string; className?: string }) {
  return <MarkdownPreview markdown={content} variant="chat" className={className} />;
}
