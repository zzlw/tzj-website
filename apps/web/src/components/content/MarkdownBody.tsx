'use client';

import { MarkdownBody as UiMarkdownBody } from '@tzj/ui';
import { markdownImageComponents } from './markdown-components';

/**
 * web 内容页（blog / news / cases / trade-shows）的 Markdown 正文渲染。
 * 引擎与基础样式来自 @tzj/ui 的 MarkdownBody，图片用 next/image 优化版本注入。
 *
 * 必须是 Client Component：components 映射含函数（img 覆盖），
 * 若在 Server Component 中直接传给 'use client' 的 UiMarkdownBody，
 * RSC 序列化会抛 "Functions cannot be passed to Client Components"，
 * 详情页整页被 ErrorBoundary 接管（曾被误认为 404）。
 */
export function MarkdownBody({
  content,
  className = '',
}: {
  content?: string | null;
  className?: string;
}) {
  if (!content?.trim()) return null;
  return (
    <UiMarkdownBody content={content} className={className} components={markdownImageComponents} />
  );
}
