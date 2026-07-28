'use client';

import { Suspense } from 'react';
import { ContentPagination } from '@/components/content/ContentPagination';
import type { SearchPagination as SearchPaginationData } from '@/lib/search/types';

function SearchPaginationInner({
  pagination,
  unit,
}: {
  pagination: SearchPaginationData;
  unit: string;
}) {
  return (
    <ContentPagination
      pagination={{
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        totalPages: pagination.totalPages,
      }}
      unit={unit}
      pageSizeOptions={[12, 24, 48]}
    />
  );
}

export function SearchPagination({
  pagination,
  unit,
}: {
  pagination: SearchPaginationData;
  unit: string;
}) {
  if (pagination.total <= 0) return null;

  return (
    <Suspense fallback={null}>
      <SearchPaginationInner pagination={pagination} unit={unit} />
    </Suspense>
  );
}
