'use client';

import { TablePagination } from '@tzj/ui';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import type { NormalizedPagination } from '@/lib/content-list';

interface ContentPaginationProps {
  pagination: NormalizedPagination;
  unit?: string;
  pageSizeOptions?: number[];
}

/** C 端列表分页：基于 @tzj/ui TablePagination，同步 URL query。 */
export function ContentPagination({
  pagination,
  unit = '条',
  pageSizeOptions = [9, 12, 24],
}: ContentPaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function pushPage(page: number, limit?: number) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('page', String(page));
    if (limit) sp.set('limit', String(limit));
    startTransition(() => {
      router.push(`${pathname}?${sp.toString()}`, { scroll: false });
    });
  }

  if (pagination.total <= 0) return null;

  return (
    <TablePagination
      page={pagination.page}
      totalPages={pagination.totalPages}
      total={pagination.total}
      pageSize={pagination.pageSize}
      pageSizeOptions={pageSizeOptions}
      unit={unit}
      onPageChange={(p) => pushPage(p)}
      onPageSizeChange={(size) => pushPage(1, size)}
    />
  );
}
