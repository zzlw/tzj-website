import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/** shadcn/ui Skeleton — https://ui.shadcn.com/docs/components/skeleton */
function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

export { Skeleton };
