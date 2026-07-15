import { Container } from '@/components/ui';

/** 首页首屏以下 Streaming 占位，保留布局高度减少 CLS。 */
export function HomeBelowFoldSkeleton() {
  return (
    <div aria-hidden="true" className="bg-white">
      <div className="border-b border-neutral-200 py-16">
        <Container>
          <div className="mx-auto h-8 w-48 animate-pulse rounded bg-neutral-200" />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] animate-pulse bg-neutral-100" />
            ))}
          </div>
        </Container>
      </div>
      <div className="min-h-[480px] animate-pulse bg-neutral-100" />
    </div>
  );
}
