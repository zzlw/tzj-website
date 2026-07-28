import { Skeleton } from '@tzj/ui';

/** 整页级加载骨架：路由切换时由各 loading.tsx 复用，仅此一种变体（不做列表/详情细分）。 */
export function PageSkeleton() {
  return (
    <div aria-busy="true">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => i).map((i) => (
          <Skeleton key={i} className="h-[88px]" />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
