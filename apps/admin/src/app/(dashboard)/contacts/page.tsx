'use client';

import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  cn,
  DataTable,
  type DataTableColumn,
  Label,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SimpleDialog,
  TablePagination,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@tzj/ui';
import { Eye, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Can } from '@/components/Can';
import { LastOperatorCell } from '@/components/LastOperatorCell';
import { formatDateTime } from '@/features/constants';
import { ContactVisitorPanel } from '@/features/contacts/components/VisitorInsightPanel';
import { useList, useRemove, useUpdate } from '@/features/hooks';
import type { ContactItem } from '@/features/types';
import { ApiError } from '@/lib/apiClient';
import { notifyError, notifySuccess } from '@/lib/notify';
import { enumField, intField, useUrlState } from '@/lib/use-url-state';

const FILTERS = [
  { key: 'unread', label: '未读', params: { isRead: false } },
  { key: 'unhandled', label: '待处理', params: { isHandled: false } },
] as const;

const CONTACT_STATUS = {
  pending: {
    label: '待处理',
    dot: 'bg-amber-500',
    trigger:
      'border-amber-300/80 bg-amber-50 text-amber-800 hover:bg-amber-50 focus:ring-amber-200/60',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  handled: {
    label: '已处理',
    dot: 'bg-emerald-500',
    trigger:
      'border-emerald-300/80 bg-emerald-50 text-emerald-800 hover:bg-emerald-50 focus:ring-emerald-200/60',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
} as const;

type ContactStatusKey = keyof typeof CONTACT_STATUS;

function ContactHandleBadge({ handled }: { handled: boolean }) {
  const status = CONTACT_STATUS[handled ? 'handled' : 'pending'];
  return (
    <Badge variant="outline" className={cn('gap-1.5 pl-2', status.badge)}>
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', status.dot)} />
      {status.label}
    </Badge>
  );
}

function ContactHandleStatusSelect({
  handled,
  onChange,
}: {
  handled: boolean;
  onChange: (handled: boolean) => void;
}) {
  const value: ContactStatusKey = handled ? 'handled' : 'pending';
  const current = CONTACT_STATUS[value];

  return (
    <Select value={value} onValueChange={(v) => onChange(v === 'handled')}>
      <SelectTrigger className={cn('h-9 w-[148px] font-medium shadow-none', current.trigger)}>
        <span className="flex items-center gap-2">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', current.dot)} />
          {current.label}
        </span>
      </SelectTrigger>
      <SelectContent>
        {(
          Object.entries(CONTACT_STATUS) as [
            ContactStatusKey,
            (typeof CONTACT_STATUS)[ContactStatusKey],
          ][]
        ).map(([key, status]) => (
          <SelectItem key={key} value={key}>
            <span className="flex items-center gap-2">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', status.dot)} />
              {status.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const CONTACT_COLUMNS: DataTableColumn<ContactItem>[] = [
  {
    key: 'name',
    header: '联系人',
    className: 'font-medium',
    cell: (r) => (
      <>
        {!r.isRead && (
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />
        )}
        {r.name}
      </>
    ),
  },
  {
    key: 'company',
    header: '单位',
    className: 'text-muted-foreground',
    cell: (r) => r.company ?? '—',
  },
  {
    key: 'contact',
    header: '联系方式',
    className: 'text-muted-foreground',
    cell: (r) => r.phone || r.email || '—',
  },
  {
    key: 'message',
    header: '留言摘要',
    className: 'max-w-[260px] truncate text-muted-foreground',
    cell: (r) => r.message,
  },
  {
    key: 'status',
    header: '状态',
    cell: (r) => <ContactHandleBadge handled={r.isHandled} />,
  },
  {
    key: 'createdAt',
    header: '创建时间',
    className: 'whitespace-nowrap text-muted-foreground',
    cell: (r) => formatDateTime(r.createdAt),
  },
  {
    key: 'updatedAt',
    header: '更新时间',
    className: 'whitespace-nowrap text-muted-foreground',
    cell: (r) => formatDateTime(r.updatedAt),
  },
  {
    key: 'lastOperator',
    header: '最后操作人',
    cell: (r) => <LastOperatorCell user={r.lastOperatorUser} fallback={r.lastOperator} />,
  },
];

export default function ContactsPage() {
  const [urlState, setUrlState] = useUrlState({
    page: intField(1, { min: 1 }),
    pageSize: intField(10, { min: 1 }),
    tab: enumField(['all', 'unread', 'unhandled'] as const, 'all'),
  });
  const { page, pageSize, tab } = urlState;
  const [detail, setDetail] = useState<ContactItem | null>(null);
  const [remark, setRemark] = useState('');
  const [handledDraft, setHandledDraft] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContactItem | null>(null);

  const params = useMemo(() => {
    const base: Record<string, string | number | boolean> = { page, limit: pageSize };
    const f = FILTERS.find((x) => x.key === tab);
    return f ? { ...base, ...f.params } : base;
  }, [page, pageSize, tab]);

  const { data, isLoading, isError, error } = useList<ContactItem>('contact', params);
  const updateMut = useUpdate<ContactItem>('contact');
  const removeMut = useRemove('contact');

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  function openDetail(row: ContactItem) {
    setDetail(row);
    setRemark(row.remark ?? '');
    setHandledDraft(row.isHandled);
    if (!row.isRead) {
      updateMut.mutate({ id: row.id, payload: { isRead: true } });
    }
  }

  async function saveDetail() {
    if (!detail) return;
    try {
      await updateMut.mutateAsync({
        id: detail.id,
        payload: { remark, isHandled: handledDraft },
      });
      setDetail(null);
      notifySuccess('询盘已保存');
    } catch (e) {
      notifyError(e, '保存失败');
    }
  }

  const detailDirty =
    detail !== null && (remark !== (detail.remark ?? '') || handledDraft !== detail.isHandled);

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await removeMut.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      notifySuccess('询盘已删除');
    } catch (e) {
      notifyError(e, '删除失败');
    }
  }

  function renderActions(r: ContactItem) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(r)}>
              <Eye className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>查看</TooltipContent>
        </Tooltip>
        <Can perm="contacts.delete">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:text-destructive"
                onClick={() => setDeleteTarget(r)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>删除</TooltipContent>
          </Tooltip>
        </Can>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <PageHeader title="询盘管理" description="查看并处理来自官网的客户咨询" />

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setUrlState({ tab: v as typeof tab, page: 1 });
        }}
        className="mb-6"
      >
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="unread">未读</TabsTrigger>
          <TabsTrigger value="unhandled">待处理</TabsTrigger>
        </TabsList>
      </Tabs>

      {isError && (
        <Alert variant="destructive" icon="error" className="mb-4">
          加载失败：{error instanceof Error ? error.message : '未知错误'}
          {error instanceof ApiError && error.status === 401
            ? '（会话已过期，请重新登录）'
            : error instanceof ApiError && error.status === 403
              ? '（无询盘查看权限，请联系管理员）'
              : null}
        </Alert>
      )}

      <DataTable
        columns={CONTACT_COLUMNS}
        rows={rows}
        loading={isLoading}
        emptyText="暂无询盘"
        getRowClassName={(r) => (!r.isRead ? 'bg-primary/[0.03]' : undefined)}
        renderActions={renderActions}
      />

      {pagination && (
        <TablePagination
          page={page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          pageSize={pageSize}
          onPageChange={(p) => setUrlState({ page: p })}
          onPageSizeChange={(size) => {
            setUrlState({ pageSize: size, page: 1 });
          }}
        />
      )}

      <SimpleDialog
        open={detail !== null}
        onClose={() => setDetail(null)}
        wide
        title="询盘详情"
        footer={
          detail && (
            <Can perm="contacts.manage">
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDetail(null)}
                  disabled={updateMut.isPending}
                >
                  取消
                </Button>
                <Button onClick={saveDetail} disabled={updateMut.isPending || !detailDirty}>
                  保存
                </Button>
              </div>
            </Can>
          )
        }
      >
        {detail && (
          <div className="space-y-4 text-sm">
            <DetailRow label="联系人" value={detail.name} />
            <DetailRow label="单位" value={detail.company ?? '—'} />
            <DetailRow label="电话" value={detail.phone ?? '—'} />
            <DetailRow label="邮箱" value={detail.email ?? '—'} />
            <DetailRow label="主题" value={detail.subject ?? '—'} />
            <DetailRow label="来源" value={detail.source ?? '—'} />
            <DetailRow label="创建时间" value={formatDateTime(detail.createdAt)} />
            <DetailRow label="更新时间" value={formatDateTime(detail.updatedAt)} />
            <ContactVisitorPanel contact={detail} />
            <div className="flex gap-3">
              <span className="w-16 shrink-0 text-muted-foreground">最后操作人</span>
              <LastOperatorCell
                user={detail.lastOperatorUser}
                fallback={detail.lastOperator}
                profileOnHover={false}
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-muted-foreground">状态</span>
              <Can perm="contacts.manage" fallback={<ContactHandleBadge handled={handledDraft} />}>
                <ContactHandleStatusSelect handled={handledDraft} onChange={setHandledDraft} />
              </Can>
            </div>
            <div>
              <Label className="text-muted-foreground">留言内容</Label>
              <div className="mt-2 rounded-md border border-border bg-muted/30 p-3 whitespace-pre-wrap text-foreground">
                {detail.message}
              </div>
            </div>
            <div>
              <Label htmlFor="remark">处理备注</Label>
              <Textarea
                id="remark"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                rows={3}
                placeholder="填写处理情况…"
                className="mt-2"
              />
            </div>
          </div>
        )}
      </SimpleDialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="删除询盘"
        description="确认删除该询盘？此操作不可撤销。"
        confirmLabel="删除"
        onConfirm={handleDeleteConfirm}
        loading={removeMut.isPending}
      />
    </TooltipProvider>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
