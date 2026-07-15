import type { ReactNode } from 'react';

/** 将 [文字](url) 解析为可点击链接，其余按换行分段 */
export function RichHint({ text, className }: { text: string; className?: string }) {
  const paragraphs = text.split(/\n\n+/);

  return (
    <div className={className}>
      {paragraphs.map((paragraph, pi) => (
        <p key={pi} className={pi > 0 ? 'mt-2' : undefined}>
          {parseInlineLinks(paragraph)}
        </p>
      ))}
    </div>
  );
}

function parseInlineLinks(text: string): ReactNode[] {
  const linkRe = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = linkRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    nodes.push(
      <a
        key={key++}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:text-primary/80"
      >
        {match[1]}
      </a>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}
