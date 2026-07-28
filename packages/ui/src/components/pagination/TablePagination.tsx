'use client';

import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { Input } from '../input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select';
import { buildPageItems } from './buildPageItems';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from './Pagination';

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export interface TablePaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** 计数单位，如「条」「项」 */
  unit?: string;
  className?: string;
}

/**
 * 数据表格分页器：基于 shadcn Pagination 原语组合，
 * 含每页条数、页码、首页/末页、跳转（参考 ui.shadcn.com data table 实践）。
 */
export function TablePagination({
  page,
  totalPages,
  total,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageChange,
  onPageSizeChange,
  unit = '条',
  className,
}: TablePaginationProps) {
  const [jumpValue, setJumpValue] = useState(String(page));

  useEffect(() => {
    setJumpValue(String(page));
  }, [page]);

  if (total <= 0) return null;

  const safeTotalPages = Math.max(1, totalPages);
  const pageItems = buildPageItems(page, safeTotalPages);
  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const disabledCls = 'pointer-events-none opacity-50';

  function goToPage(raw: string) {
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n)) return;
    onPageChange(Math.min(safeTotalPages, Math.max(1, n)));
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between',
        'mt-6',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <span>
          共 {total} {unit}，当前 {rangeStart}–{rangeEnd}
        </span>
        <div className="flex items-center gap-2">
          <span className="shrink-0">每页</span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger className="h-8 w-[72px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="shrink-0">{unit}</span>
        </div>
      </div>

      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationLink
              aria-label="第一页"
              onClick={() => onPageChange(1)}
              disabled={page <= 1}
              className={page <= 1 ? disabledCls : undefined}
            >
              <ChevronsLeft className="h-4 w-4" />
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className={page <= 1 ? disabledCls : undefined}
            />
          </PaginationItem>

          {pageItems.map((item, index) =>
            item === 'ellipsis' ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: 省略号占位项无身份，索引 key 安全
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <PaginationLink isActive={item === page} onClick={() => onPageChange(item)}>
                  {item}
                </PaginationLink>
              </PaginationItem>
            ),
          )}

          <PaginationItem>
            <PaginationNext
              onClick={() => onPageChange(page + 1)}
              disabled={page >= safeTotalPages}
              className={page >= safeTotalPages ? disabledCls : undefined}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink
              aria-label="最后一页"
              onClick={() => onPageChange(safeTotalPages)}
              disabled={page >= safeTotalPages}
              className={page >= safeTotalPages ? disabledCls : undefined}
            >
              <ChevronsRight className="h-4 w-4" />
            </PaginationLink>
          </PaginationItem>

          <PaginationItem>
            <form
              className="ml-1 flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                goToPage(jumpValue);
              }}
            >
              <span className="shrink-0 text-sm text-muted-foreground">跳至</span>
              <Input
                type="number"
                min={1}
                max={safeTotalPages}
                value={jumpValue}
                onChange={(e) => setJumpValue(e.target.value)}
                className="h-8 w-14 px-2 text-center"
                aria-label="页码"
              />
              <span className="shrink-0 text-sm text-muted-foreground">页</span>
              <PaginationLink size="default" className="h-8 px-2.5" type="submit">
                跳转
              </PaginationLink>
            </form>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
