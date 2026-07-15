/**
 * Markdown 正文清洗：CMS 存原文，渲染端再 sanitize HTML。
 * 写入层仅做基础规范化，避免 HTML 混存与异常字符。
 */
const MAX_LENGTH = 500_000;

export function sanitizeMarkdown(markdown: string | null | undefined): string | null {
  if (markdown == null) return null;
  const trimmed = String(markdown).replace(/\0/g, '').trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_LENGTH ? trimmed.slice(0, MAX_LENGTH) : trimmed;
}
