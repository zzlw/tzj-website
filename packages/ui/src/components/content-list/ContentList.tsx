import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Card } from '../card';

export interface ContentListProps {
  children: ReactNode;
  className?: string;
}

/** 内容浏览列表容器（带分隔线的 Card）。 */
export function ContentList({ children, className }: ContentListProps) {
  return (
    <Card className={cn('overflow-hidden border-border/80 py-0 shadow-sm', className)}>
      <div className="divide-y divide-border/60">{children}</div>
    </Card>
  );
}
