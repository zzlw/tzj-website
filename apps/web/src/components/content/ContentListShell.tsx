"use client";

import { Suspense, type ReactNode } from "react";
import { Skeleton } from "@tzj/ui";
import { ContentListToolbar, type ContentFilterDef } from "./ContentListToolbar";
import type { SortPreset } from "@/lib/content-list";

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
