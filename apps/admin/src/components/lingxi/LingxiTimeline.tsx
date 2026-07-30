'use client';

import type { LingxiTimelineItem } from '@tzj/types';
/**
 * thinking/tool 帧折叠时间线（docs/lingxi-ai-report-design.md §7.2）。
 * 生成中默认展开、完成后自动折叠；取数动作显示工具名 + 人类可读摘要。
 */
import { Collapsible, CollapsibleContent, CollapsibleTrigger, cn } from '@tzj/ui';
import { ChevronRight, Database, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

export function LingxiTimeline({
  items,
  streaming,
}: {
  items: LingxiTimelineItem[];
  streaming?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(streaming));

  // 生成结束后自动折叠，让视线回到报告正文
  useEffect(() => {
    if (streaming) setOpen(true);
    else setOpen(false);
  }, [streaming]);

  if (items.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-2">
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
        分析过程 · {items.length} 步
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="mt-2 space-y-1.5 border-l border-border pl-4">
          {items.map((item, index) => (
            <li
              key={`${item.type}-${index}-${item.type === 'tool' ? item.name : item.text.slice(0, 12)}`}
              className="flex items-start gap-2 text-xs text-muted-foreground"
            >
              {item.type === 'thinking' ? (
                <>
                  <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <span>{item.text}</span>
                </>
              ) : (
                <>
                  <Database className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <span>
                    <code className="rounded-sm bg-muted px-1 py-px font-mono text-[11px]">
                      {item.name}
                    </code>{' '}
                    {item.summary}
                  </span>
                </>
              )}
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}
