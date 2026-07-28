import type { ReactNode } from 'react';
import type { ChatMessageSender, ChatRoomMatchedMessage } from '../types';

/**
 * 会话正文搜索命中的片段高亮工具（坐席端多处复用：
 * 主聊天页会话列表 ChatConversationList、访客 360° 档案抽屉 VisitorProfileSheet）。
 * 纯渲染，无副作用/无 hook，可安全被任意客户端组件引用。
 */

/** 发送者中文前缀（列表预览 / 命中片段共用） */
export function senderPrefix(sender: ChatMessageSender): string {
  if (sender === 'agent') return '客服: ';
  if (sender === 'system') return '系统: ';
  return '访客: ';
}

/** 命中片段窗口：关键词前保留的引导字符数与整体最大长度（业内做法：围绕首个命中裁剪上下文） */
const SNIPPET_LEAD = 12;
const SNIPPET_MAX = 80;

/** 围绕首个命中位置裁出一段上下文，避免长消息把整行撑爆 */
export function buildSnippet(
  content: string,
  query: string,
): { text: string; leadingEllipsis: boolean } {
  const idx = content.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return { text: content.slice(0, SNIPPET_MAX), leadingEllipsis: false };
  const start = Math.max(0, idx - SNIPPET_LEAD);
  return { text: content.slice(start, start + SNIPPET_MAX), leadingEllipsis: start > 0 };
}

/** 将文本中所有（大小写不敏感）命中关键词包裹 <mark> 高亮 */
export function highlightParts(text: string, query: string): ReactNode[] {
  if (!query) return [text];
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  while (cursor < text.length) {
    const found = lower.indexOf(q, cursor);
    if (found < 0) {
      parts.push(text.slice(cursor));
      break;
    }
    if (found > cursor) parts.push(text.slice(cursor, found));
    parts.push(
      <mark key={key++} className="text-foreground rounded bg-warning/25 px-0.5 dark:bg-warning/40">
        {text.slice(found, found + query.length)}
      </mark>,
    );
    cursor = found + query.length;
  }
  return parts;
}

/** 正文搜索命中时的行内片段：发送者前缀 + 高亮关键词（替代常规最后一条预览） */
export function MatchedSnippet({
  matched,
  query,
}: {
  matched: ChatRoomMatchedMessage;
  query: string;
}) {
  const { text, leadingEllipsis } = buildSnippet(matched.content, query);
  return (
    <p className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
      {senderPrefix(matched.sender)}
      {leadingEllipsis ? '…' : ''}
      {highlightParts(text, query)}
    </p>
  );
}
