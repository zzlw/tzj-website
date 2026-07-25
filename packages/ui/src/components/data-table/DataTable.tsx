'use client';

import {
  flexRender,
  getCoreRowModel,
  type ColumnDef as TanstackColumnDef,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { Card } from '../card';
import { Skeleton } from '../skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../table';

export type SortOrder = 'asc' | 'desc';

/** 左固定列阴影：分隔线 + 右侧外挂 10px 渐变（::after 画在相邻内容上方，不受 border-collapse 限制） */
const PIN_LEFT_SHADOW =
  'border-r border-border after:pointer-events-none after:absolute after:inset-y-0 after:left-full after:w-2.5 after:bg-gradient-to-r after:from-black/15 after:to-transparent';
/** 右固定列阴影：分隔线 + 左侧外挂 10px 渐变 */
const PIN_RIGHT_SHADOW =
  'border-l border-border after:pointer-events-none after:absolute after:inset-y-0 after:right-full after:w-2.5 after:bg-gradient-to-l after:from-black/15 after:to-transparent';

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
  /** 固定到右侧（列过多横向溢出时保持可见，常用于操作列）。 */
  pinRight?: boolean;
  /** 固定到左侧（列过多横向溢出时保持可见，常用于 ID/标识列）。 */
  pinLeft?: boolean;
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
  /** 固定操作列到右侧（宽表横向滚动时保持可见）。 */
  pinActions?: boolean;
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
  pinActions,
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
      meta: { className: c.className, pinRight: c.pinRight, pinLeft: c.pinLeft },
    }));
    if (renderActions) {
      cols.push({
        id: '__actions',
        header: () => '操作',
        cell: ({ row }) => renderActions(row.original),
        meta: pinActions ? { pinRight: true } : undefined,
      });
    }
    return cols;
  }, [columns, renderActions, sort, defaultSort, onSortChange, pinActions]);

  const table = useReactTable({
    data: rows,
    columns: tanstackColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const colCount = tanstackColumns.length;

  // 固定列滚动阴影：仅当该侧有内容被滚出视口时，才给对应固定列加分隔线 + 阴影，
  // 滚到边缘（无遮挡内容）时隐去，避免未滚动的表格出现多余竖线。这是让用户「感知列已固定」的关键。
  // 实现注意：Tailwind preflight 将 table 设为 border-collapse，而 CSS 规范规定 collapse 模型下
  // box-shadow 对 td/th 不生效（曾直接给单元格加 shadow-* 完全不渲染）。
  // 故采用业内通行方案（Ant Design 同款）：用 ::after 伪元素在固定列外侧画渐变阴影。
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [atLeft, setAtLeft] = useState(true);
  const [atRight, setAtRight] = useState(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setAtLeft(scrollLeft <= 0);
      // -1 容差：抵消部分浏览器在缩放/小数像素下的取整误差
      setAtRight(scrollLeft + clientWidth >= scrollWidth - 1);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
    // rows/loading/colCount 变化会改变内容宽度，需重算是否溢出
  }, [rows, loading, colCount]);

  return (
    <Card className="overflow-hidden border-border/80 py-0 shadow-sm">
      <Table containerRef={scrollRef}>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="hover:bg-transparent">
              {hg.headers.map((header) => {
                const meta = header.column.columnDef.meta as
                  | { pinRight?: boolean; pinLeft?: boolean }
                  | undefined;
                return (
                  <TableHead
                    key={header.id}
                    className={cn(
                      'whitespace-nowrap',
                      header.column.id === '__actions' && 'text-right',
                      meta?.pinRight && 'sticky right-0 z-20 bg-card text-right',
                      meta?.pinRight && !atRight && PIN_RIGHT_SHADOW,
                      meta?.pinLeft && 'sticky left-0 z-20 bg-card',
                      meta?.pinLeft && !atLeft && PIN_LEFT_SHADOW,
                    )}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                );
              })}
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
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as
                    | { className?: string; pinRight?: boolean; pinLeft?: boolean }
                    | undefined;
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        cell.column.id === '__actions' ? 'text-right' : meta?.className,
                        meta?.pinRight && 'sticky right-0 z-10 bg-card',
                        meta?.pinRight && !atRight && PIN_RIGHT_SHADOW,
                        meta?.pinLeft && 'sticky left-0 z-10 bg-card',
                        meta?.pinLeft && !atLeft && PIN_LEFT_SHADOW,
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
