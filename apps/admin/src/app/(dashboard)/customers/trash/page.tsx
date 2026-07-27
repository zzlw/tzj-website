'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  PageHeader,
  TablePagination,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@tzj/ui';
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useSession } from '@/components/session';
import { formatDateTime } from '@/features/constants';
import { useList } from '@/features/hooks';
import type { CustomerItem } from '@/features/types';
import { api } from '@/lib/apiClient';
import { notifyError, notifySuccess } from '@/lib/notify';
import { intField, useUrlState } from '@/lib/use-url-state';

/** 回收站列：仅保留识别与断链留痕所需字段，不渲染完整客户表列。 */
const TRASH_COLUMNS: DataTableColumn<CustomerItem>[] = [
  {
    key: 'name',
    header: '联系人',
    className: 'font-medium whitespace-nowrap',
    cell: (r) => r.name,
  },
  {
    key: 'company',
    header: '客户单位',
    className: 'text-muted-foreground',
    cell: (r) => r.company ?? '—',
  },
  {
    key: 'contact',
    header: '联系方式',
    className: 'whitespace-nowrap text-muted-foreground',
    cell: (r) => r.phone || r.email || '—',
  },
  {
    key: 'owner',
    header: '归属',
    className: 'whitespace-nowrap',
    cell: (r) =>
      r.owner ? (
        <span className="font-medium">{r.owner.nickname || r.owner.username}</span>
      ) : (
        <span className="text-muted-foreground">公海</span>
      ),
  },
  {
    key: 'deletedAt',
    header: '删除时间',
    className: 'whitespace-nowrap text-muted-foreground',
    cell: (r) => (r.deletedAt ? formatDateTime(r.deletedAt) : '—'),
  },
];

/**
 * 客户回收站：软删客户 30 天内可恢复，到期由每日任务自动永久清理。
 * 恢复不回填原询盘/会话锚点（软删时已置空，见 docs/design/deletion-strategy.md §3.2-B）；
 * 永久删除仅管理员（后端同步校验）。非管理员仅能看到自己私海的已删客户（后端 scope 回落）。
 */
export default function CustomerTrashPage() {
  const [urlState, setUrlState] = useUrlState({
    page: intField(1, { min: 1 }),
    pageSize: intField(10, { min: 1 }),
  });
  const { page, pageSize } = urlState;
  const [purgeTarget, setPurgeTarget] = useState<CustomerItem | null>(null);
  const qc = useQueryClient();
  const { role, permissions } = useSession();
  const isAdmin = role === 'admin';
  const canDelete = permissions.includes('customers.delete') || permissions.includes('*');

  const { data, isLoading, isError, error } = useList<CustomerItem>('customers', {
    page,
    limit: pageSize,
    scope: 'all',
    deleted: true,
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => api.post(`customers/${id}/restore`, {}),
    onSuccess: () => {
      notifySuccess('客户已恢复', '原询盘/会话关联不会回填');
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (e) => notifyError(e, '恢复失败'),
  });
  const purgeMut = useMutation({
    mutationFn: (id: string) => api.remove('customers', id, { purge: true }),
    onSuccess: () => {
      setPurgeTarget(null);
      notifySuccess('已永久删除');
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (e) => notifyError(e, '永久删除失败'),
  });

  if (!canDelete) {
    return (
      <Alert variant="destructive" icon="error">
        无客户删除权限，无法查看回收站。
      </Alert>
    );
  }

  return (
    <TooltipProvider>
      <PageHeader
        title="客户回收站"
        description="已删除客户 30 天后自动永久清理；恢复后不回填原询盘/会话关联"
        action={
          <Button asChild variant="outline">
            <Link href="/customers/mine">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回客户列表
            </Link>
          </Button>
        }
      />

      {isError && (
        <Alert variant="destructive" icon="error" className="mb-4">
          加载失败：{error instanceof Error ? error.message : '未知错误'}
        </Alert>
      )}

      <DataTable
        columns={TRASH_COLUMNS}
        rows={data?.data ?? []}
        loading={isLoading}
        emptyText="回收站为空"
        renderActions={(r) => (
          <div className="flex items-center justify-end gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={restoreMut.isPending}
                  onClick={() => restoreMut.mutate(r.id)}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>恢复</TooltipContent>
            </Tooltip>
            {isAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:text-destructive"
                    onClick={() => setPurgeTarget(r)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>永久删除</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      />

      {data?.pagination && (
        <TablePagination
          page={page}
          totalPages={data.pagination.totalPages}
          total={data.pagination.total}
          pageSize={pageSize}
          onPageChange={(p) => setUrlState({ page: p })}
          onPageSizeChange={(size) => {
            setUrlState({ pageSize: size, page: 1 });
          }}
        />
      )}

      <ConfirmDialog
        open={purgeTarget !== null}
        onOpenChange={(open) => !open && setPurgeTarget(null)}
        title="永久删除客户"
        description={
          purgeTarget
            ? `确认永久删除客户「${purgeTarget.name}」？此操作不可撤销；仍指向该客户的会话关联将被解除。`
            : undefined
        }
        confirmLabel="永久删除"
        onConfirm={() => {
          if (purgeTarget) purgeMut.mutate(purgeTarget.id);
        }}
        loading={purgeMut.isPending}
      />
    </TooltipProvider>
  );
}
