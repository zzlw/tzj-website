import type { ReactNode } from 'react';

/**
 * 在文本中高亮命中的检索词（大小写不敏感），用于列表搜索结果标注命中位置
 * （业内检索惯例：Notion / Confluence 搜索结果高亮）。
 */
export function highlightKeyword(text: string, keyword?: string | null): ReactNode {
  const q = keyword?.trim();
  if (!q || !text) return text;
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  let hit = lower.indexOf(ql);
  if (hit === -1) return text;
  const parts: ReactNode[] = [];
  let idx = 0;
  while (hit !== -1) {
    if (hit > idx) parts.push(text.slice(idx, hit));
    parts.push(
      <mark
        key={hit}
        className="rounded-sm bg-amber-200/70 px-0.5 text-inherit dark:bg-amber-500/30"
      >
        {text.slice(hit, hit + q.length)}
      </mark>,
    );
    idx = hit + q.length;
    hit = lower.indexOf(ql, idx);
  }
  if (idx < text.length) parts.push(text.slice(idx));
  return parts;
}
