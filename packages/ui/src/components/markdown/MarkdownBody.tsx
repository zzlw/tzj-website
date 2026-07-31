'use client';

import Markdown, { type Components } from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

function isExternalHref(href?: string): boolean {
  if (!href) return false;
  return /^https?:\/\//i.test(href);
}

/**
 * 基础 Markdown 组件映射（纯 Tailwind 样式，无业务耦合）。
 * - 标题尺寸类（rb-h3 / rb-h4 / rb-h5）由消费端（web）的全局 CSS 提供，渲染时仍生效。
 * - 未定义 img，由 react-markdown 默认渲染；web 端通过 MarkdownBody 的 components
 *   属性覆盖为 next/image 优化版本（见 apps/web 的 markdownImageComponents）。
 * - 与 @tzj/ui 既有的 Vditor 版 MarkdownPreview 并存：本组件面向 CMS 正文，
 *   MarkdownPreview 面向编辑器预览 / 聊天气泡，二者引擎不同但样式收敛在同一设计系统。
 */
export const markdownBaseComponents: Components = {
  h1: ({ children }) => <h1 className="rb-h3 mt-12 text-neutral-900 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="rb-h4 mt-10 text-neutral-900 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="rb-h5 mt-8 text-neutral-900 first:mt-0">{children}</h3>,
  h4: ({ children }) => (
    <h4 className="mt-6 text-base font-bold text-neutral-900 first:mt-0">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="mt-4 text-base leading-relaxed text-secondary-text first:mt-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mt-5 list-disc space-y-2 pl-5 text-base leading-relaxed text-secondary-text marker:text-primary first:mt-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-5 list-decimal space-y-2 pl-5 text-base leading-relaxed text-secondary-text marker:font-semibold marker:text-neutral-900 first:mt-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="text-neutral-900 [&>p]:mt-0 [&>p]:inline">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mt-6 border-l-4 border-primary pl-5 text-lg leading-relaxed text-neutral-900 first:mt-0">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => {
    const external = isExternalHref(href);
    return (
      <a
        href={href}
        className="font-semibold text-primary underline-offset-2 hover:underline"
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </a>
    );
  },
  strong: ({ children }) => <strong className="font-semibold text-neutral-900">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="my-10 border-neutral-300" />,
  code: ({ className, children }) => {
    const isBlock = Boolean(className);
    if (isBlock) {
      return (
        <code
          className={`block overflow-x-auto rounded-sm bg-neutral-100 p-4 text-sm ${className ?? ''}`}
        >
          {children}
        </code>
      );
    }
    return (
      <code className="rounded-sm bg-neutral-100 px-1.5 py-0.5 font-mono text-sm text-neutral-900">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mt-6 overflow-x-auto rounded-sm bg-neutral-100 p-4 text-sm first:mt-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="mt-6 overflow-x-auto first:mt-0">
      <table className="w-full min-w-[480px] border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-neutral-100">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-neutral-300 px-4 py-2 text-left font-semibold text-neutral-900">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-neutral-300 px-4 py-2 text-secondary-text">{children}</td>
  ),
};

export type MarkdownComponents = Components;

/**
 * 统一的 CMS 正文 Markdown 渲染组件（react-markdown 引擎）。
 * 默认施加 GFM、软换行转 <br>（remark-breaks，与后台 Vditor 编辑器所见一致，
 * 否则运营单回车换行被标准 Markdown 折叠成空格）与 rehype-sanitize（防 XSS）；
 * 基础组件映射见 markdownBaseComponents。
 * 消费端可传入 components 覆盖任意元素（典型：把 img 换成 next/image 优化版本）。
 */
export function MarkdownBody({
  content,
  className = '',
  components,
}: {
  content?: string | null;
  className?: string;
  components?: Components;
}) {
  if (!content?.trim()) return null;
  const merged: Components = { ...markdownBaseComponents, ...components };
  return (
    <div className={className}>
      <Markdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeSanitize]}
        components={merged}
      >
        {content}
      </Markdown>
    </div>
  );
}
