'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  type DataTableColumn,
  type DataTableSort,
  DateRangePicker,
  Input,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SimpleDialog,
  TablePagination,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@tzj/ui';
import { Eye, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Can } from '@/components/Can';
import {
  AUDIT_ACTION_OPTIONS,
  AUDIT_RESOURCE_OPTIONS,
  auditActionLabel,
  auditResourceLabel,
  auditUserLabel,
  formatAuditDateTime,
  useAuditLogList,
} from '@/features/audit';
import { useList } from '@/features/hooks';
import type { AuditLogItem } from '@/features/types';

const DEFAULT_SORT: DataTableSort = { column: 'createdAt', order: 'desc' };

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [userId, setUserId] = useState<string>('all');
  const [resource, setResource] = useState<string>('all');
  const [action, setAction] = useState<string>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<DataTableSort | null>(DEFAULT_SORT);
  const [detailId, setDetailId] = useState<string | null>(null);

  const params = useMemo(
    () => ({
      page,
      limit: pageSize,
      userId: userId === 'all' ? undefined : userId,
      resource: resource === 'all' ? undefined : resource,
      action: action === 'all' ? undefined : action,
      from: from || undefined,
      to: to || undefined,
      search: search || undefined,
      sortBy: sort?.column,
      sortOrder: sort?.order,
    }),
    [page, pageSize, userId, resource, action, from, to, search, sort],
  );

  const { data, isLoading, isFetching } = useAuditLogList(params);
  const rows = data?.data ?? [];
  const pagination = data?.pagination;
  const detailRow = rows.find((r) => r.id === detailId) ?? null;

  const { data: usersData } = useList<{ id: string; username: string; nickname?: string | null }>(
    'users',
    { page: 1, limit: 100 },
  );
  const userOptions = usersData?.data ?? [];

  const columns: DataTableColumn<AuditLogItem>[] = useMemo(
    () => [
      {
        key: 'createdAt',
        header: '时间',
        sortable: true,
        className: 'whitespace-nowrap text-muted-foreground',
        cell: (r) => formatAuditDateTime(r.createdAt),
      },
      {
        key: 'user',
        header: '操作人',
        sortable: true,
        sortKey: 'user',
        className: 'font-medium',
        cell: (r) => auditUserLabel(r),
      },
      {
        key: 'action',
        header: '动作',
        sortable: true,
        cell: (r) => <Badge variant="outline">{auditActionLabel(r.action)}</Badge>,
      },
      {
        key: 'resource',
        header: '资源',
        sortable: true,
        cell: (r) => auditResourceLabel(r.resource),
      },
      {
        key: 'resourceId',
        header: '资源 ID',
        sortable: true,
        className: 'max-w-[140px] truncate font-mono text-xs text-muted-foreground',
        cell: (r) => r.resourceId ?? '—',
      },
      {
        key: 'ip',
        header: 'IP',
        sortable: true,
        className: 'whitespace-nowrap text-muted-foreground',
        cell: (r) => r.ip ?? '—',
      },
    ],
    [],
  );

  return (
    <TooltipProvider>
      <PageHeader title="操作日志" description="查看后台账号的操作记录，便于追溯与审计。" />

      <Card className="mb-6 border-border/80 py-0 shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <form
            className="relative min-w-[220px] flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setSearch(searchInput.trim());
            }}
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="搜索操作人、资源 ID、IP、traceId…"
              className="pl-9"
            />
          </form>
          <Can perm="users.manage">
            <Select
              value={userId}
              onValueChange={(v) => {
                setUserId(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="全部操作人" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部操作人</SelectItem>
                {userOptions.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nickname?.trim() || u.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Can>
          <Select
            value={resource}
            onValueChange={(v) => {
              setResource(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="全部资源" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部资源</SelectItem>
              {AUDIT_RESOURCE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={action}
            onValueChange={(v) => {
              setAction(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder="全部动作" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部动作</SelectItem>
              {AUDIT_ACTION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DateRangePicker
            className="h-9 w-[260px]"
            from={from}
            to={to}
            onChange={({ from: nextFrom, to: nextTo }) => {
              setFrom(nextFrom);
              setTo(nextTo);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>

      <DataTable<AuditLogItem>
        columns={columns}
        rows={rows}
        loading={isLoading || isFetching}
        emptyText="暂无操作记录"
        sort={sort}
        defaultSort={DEFAULT_SORT}
        onSortChange={(next) => {
          setPage(1);
          setSort(next);
        }}
        renderActions={(r) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="查看详情"
                onClick={() => setDetailId(r.id)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>查看详情</TooltipContent>
          </Tooltip>
        )}
      />

      {pagination && pagination.total > 0 ? (
        <TablePagination
          className="mt-6"
          page={page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          pageSize={pageSize}
          pageSizeOptions={[20, 50, 100]}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          unit="条"
        />
      ) : null}

      <SimpleDialog
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        title="操作详情"
        wide
      >
        {detailRow ? (
          <div className="space-y-4">
            <DetailBlock label="时间">{formatAuditDateTime(detailRow.createdAt)}</DetailBlock>
            <DetailBlock label="操作人">{auditUserLabel(detailRow)}</DetailBlock>
            <DetailBlock label="动作">{auditActionLabel(detailRow.action)}</DetailBlock>
            <DetailBlock label="资源">
              {auditResourceLabel(detailRow.resource)}
              {detailRow.resourceId ? (
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {detailRow.resourceId}
                </span>
              ) : null}
            </DetailBlock>
            <DetailBlock label="IP">{detailRow.ip ?? '—'}</DetailBlock>
            <DetailBlock label="User-Agent">
              <p className="break-all text-xs text-muted-foreground">
                {detailRow.userAgent ?? '—'}
              </p>
            </DetailBlock>
            <DetailBlock label="Trace ID">
              <span className="font-mono text-xs">{detailRow.traceId ?? '—'}</span>
            </DetailBlock>
            <DetailBlock label="详情">
              {detailRow.detail ? (
                <pre className="max-h-48 overflow-auto rounded-md bg-muted/40 p-3 text-xs">
                  {JSON.stringify(detailRow.detail, null, 2)}
                </pre>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </DetailBlock>
          </div>
        ) : null}
      </SimpleDialog>
    </TooltipProvider>
  );
}
