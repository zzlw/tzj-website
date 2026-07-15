import { stripMarkdown } from './read-time';

const DEFAULT_MAX_LENGTH = 160;

/** 从 Markdown 正文自动生成摘要（Confluence / Notion 风格）。 */
export function generateDocumentSummary(
  content: string | null | undefined,
  maxLength = DEFAULT_MAX_LENGTH,
): string | null {
  const plain = stripMarkdown(content ?? '');
  if (!plain) return null;
  if (plain.length <= maxLength) return plain;

  const slice = plain.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > maxLength * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trim()}…`;
}
