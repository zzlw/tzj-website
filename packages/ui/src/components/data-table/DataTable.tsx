'use client';

import {
  flexRender,
  getCoreRowModel,
  type ColumnDef as TanstackColumnDef,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useMemo } from 'react';
import { cn } from '../../lib/utils';
import { Card } from '../card';
import { Skeleton } from '../skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../table';

export type SortOrder = 'asc' | 'desc';

export interface DataTableSort {
  column: string;
  order: SortOrder;
}

export interface DataTableColumn<T> {
  key: string;
  header: string;
  /** 自定义单元格渲染；未提供时按 key 读取行字段。 */
  cell?: (row: T) => React.ReactNode;
  className?: string;
  /** 是否支持服务端排序（点击表头切换 asc/desc/默认）。 */
  sortable?: boolean;
  /** API 排序字段名，默认同 key。 */
  sortKey?: string;
}

export interface DataTableProps<T extends { id: string }> {
  columns: DataTableColumn<T>[];
  rows: T[];
  loading?: boolean;
  renderActions?: (row: T) => React.ReactNode;
  emptyText?: string;
  /** 加载骨架行数 */
  skeletonRows?: number;
  /** 按行返回额外 className（如未读高亮）。 */
  getRowClassName?: (row: T) => string | undefined;
  /** 当前排序状态（服务端排序）。 */
  sort?: DataTableSort | null;
  /** 列表默认排序；第三次点击表头时恢复此状态。 */
  defaultSort?: DataTableSort | null;
  /** 排序变化：asc → desc → 恢复默认。 */
  onSortChange?: (sort: DataTableSort | null) => void;
}

function SortableHeader({
  label,
  sortKey,
  sort,
  defaultSort,
  onSortChange,
}: {
  label: string;
  sortKey: string;
  sort?: DataTableSort | null;
  defaultSort?: DataTableSort | null;
  onSortChange?: (sort: DataTableSort | null) => void;
}) {
  const active = sort?.column === sortKey;
  const Icon = active ? (sort.order === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <button
      type="button"
      className={cn(
        '-ml-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-left font-medium transition-colors',
        'hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'text-foreground' : 'text-muted-foreground',
      )}
      onClick={() => {
        if (!onSortChange) return;
        if (!active) {
          onSortChange({ column: sortKey, order: 'asc' });
          return;
        }
        if (sort!.order === 'asc') {
          onSortChange({ column: sortKey, order: 'desc' });
          return;
        }
        onSortChange(defaultSort ?? null);
      }}
      aria-sort={active ? (sort!.order === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {label}
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
    </button>
  );
}

/** TanStack Table + shadcn Table 的数据表格，带 Card 容器与 Skeleton 加载态。 */
export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  renderActions,
  emptyText = '暂无数据',
  skeletonRows = 5,
  getRowClassName,
  sort,
  defaultSort,
  onSortChange,
}: DataTableProps<T>) {
  const tanstackColumns = useMemo<TanstackColumnDef<T>[]>(() => {
    const cols: TanstackColumnDef<T>[] = columns.map((c) => ({
      id: c.key,
      header: () =>
        c.sortable ? (
          <SortableHeader
            label={c.header}
            sortKey={c.sortKey ?? c.key}
            sort={sort}
            defaultSort={defaultSort}
            onSortChange={onSortChange}
          />
        ) : (
          c.header
        ),
      cell: ({ row }) =>
        c.cell
          ? c.cell(row.original)
          : String((row.original as Record<string, unknown>)[c.key] ?? '—'),
      meta: { className: c.className },
    }));
    if (renderActions) {
      cols.push({
        id: '__actions',
        header: () => '操作',
        cell: ({ row }) => renderActions(row.original),
      });
    }
    return cols;
  }, [columns, renderActions, sort, defaultSort, onSortChange]);

  const table = useReactTable({
    data: rows,
    columns: tanstackColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const colCount = tanstackColumns.length;

  return (
    <Card className="overflow-hidden border-border/80 py-0 shadow-sm">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="hover:bg-transparent">
              {hg.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={header.column.id === '__actions' ? 'text-right' : ''}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: skeletonRows }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                {Array.from({ length: colCount }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full max-w-[12rem]" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colCount} className="h-32 text-center text-muted-foreground">
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className={getRowClassName?.(row.original)}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={
                      cell.column.id === '__actions'
                        ? 'text-right'
                        : (cell.column.columnDef.meta as { className?: string })?.className
                    }
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
