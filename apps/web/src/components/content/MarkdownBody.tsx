import { MarkdownBody as UiMarkdownBody } from '@tzj/ui';
import { markdownImageComponents } from './markdown-components';

/**
 * web 内容页（blog / news / cases / trade-shows）的 Markdown 正文渲染。
 * 引擎与基础样式来自 @tzj/ui 的 MarkdownBody，图片用 next/image 优化版本注入。
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
