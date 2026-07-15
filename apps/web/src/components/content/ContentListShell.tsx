'use client';

import { Skeleton } from '@tzj/ui';
import { type ReactNode, Suspense } from 'react';
import type { SortPreset } from '@/lib/content-list';
import { type ContentFilterDef, ContentListToolbar } from './ContentListToolbar';

function ToolbarFallback() {
  return <Skeleton className="h-[72px] w-full rounded-none" />;
}

interface ContentListShellProps {
  toolbar: {
    filters?: ContentFilterDef[];
    sortOptions: SortPreset[];
    defaultSort: SortPreset;
  };
  children: ReactNode;
}

/** 包裹 Suspense，满足 useSearchParams 的 Next.js 要求。 */
export function ContentListShell({ toolbar, children }: ContentListShellProps) {
  return (
    <>
      <Suspense fallback={<ToolbarFallback />}>
        <ContentListToolbar {...toolbar} />
      </Suspense>
      {children}
    </>
  );
}

export function ContentPaginationShell({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
