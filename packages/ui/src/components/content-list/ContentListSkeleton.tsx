import { cn } from '../../lib/utils';
import { Card } from '../card';
import { Skeleton } from '../skeleton';

export interface ContentListSkeletonProps {
  count?: number;
  className?: string;
}

/** 内容列表加载占位。 */
export function ContentListSkeleton({ count = 5, className }: ContentListSkeletonProps) {
  return (
    <Card className={cn('overflow-hidden border-border/80 py-0 shadow-sm', className)}>
      <div className="divide-y divide-border/60">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex gap-4 px-5 py-4">
            <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-2/3 max-w-md" />
              <Skeleton className="h-4 w-full max-w-lg" />
              <Skeleton className="h-3 w-1/3 max-w-xs" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
