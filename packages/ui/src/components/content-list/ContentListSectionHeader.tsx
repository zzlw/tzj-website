import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface ContentListSectionHeaderProps {
  title: string;
  icon?: ReactNode;
  className?: string;
}

/** 列表分组标题（如「置顶」）。 */
export function ContentListSectionHeader({
  title,
  icon,
  className,
}: ContentListSectionHeaderProps) {
  return (
    <div className={cn('flex items-center gap-2 bg-muted/40 px-5 py-2.5', className)}>
      {icon}
      <span className="text-xs font-semibold tracking-wide text-muted-foreground">{title}</span>
    </div>
  );
}
