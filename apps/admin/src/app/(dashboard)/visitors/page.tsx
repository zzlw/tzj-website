'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  type DataTableColumn,
  DateRangePicker,
  Input,
  PageHeader,
  Skeleton,
  TablePagination,
} from '@tzj/ui';
import { MessagesSquare, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSession } from '@/components/session';
import {
  type AnalyticsVisitorRow,
  deviceLabel,
  formatLastSeen,
  useAnalyticsVisitors,
} from '@/features/analytics';
import { VisitorProfileSheet } from '@/features/chat/components/VisitorProfileSheet';

function IdentityCell({ row }: { row: AnalyticsVisitorRow }) {
  const name = row.name || row.email || row.phone || '匿名访客';
  return (
    <div className="min-w-[180px]">
      <div className="flex items-center gap-2">
        <span className="font-medium text-foreground">{name}</span>
        {row.identified ? (
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
            已识别
          </Badge>
        ) : (
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            匿名
          </Badge>
        )}
      </div>
      <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
        {row.company ? <span>{row.company}</span> : null}
        {row.email ? <span>{row.email}</span> : null}
        {row.phone ? <span>{row.phone}</span> : null}
      </div>
    </div>
  );
}

export default function VisitorsPage() {
  const { permissions } = useSession();
  const canViewChat = permissions.includes('chat.view') || permissions.includes('*');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // 访客档案抽屉：当前查看的访客
  const [sheetVisitor, setSheetVisitor] = useState<AnalyticsVisitorRow | null>(null);

  const dateParams = useMemo(() => ({ from: from || undefined, to: to || undefined }), [from, to]);

  const params = useMemo(
    () => ({
      ...dateParams,
      q: q.trim() || undefined,
      page,
      limit: pageSize,
    }),
    [dateParams, q, page, pageSize],
  );

  const { data, isLoading, isFetching } = useAnalyticsVisitors(params);
  const loading = isLoading || isFetching;

  const columns: DataTableColumn<AnalyticsVisitorRow>[] = [
    {
      key: 'identity',
      header: '访客身份',
      cell: (r) => <IdentityCell row={r} />,
    },
    {
      key: 'sessions',
      header: '会话数',
      className: 'tabular-nums',
      cell: (r) => r.sessions.toLocaleString('zh-CN'),
    },
    {
      key: 'pageViews',
      header: 'PV',
      className: 'tabular-nums',
      cell: (r) => r.pageViews.toLocaleString('zh-CN'),
    },
    {
      key: 'deviceType',
      header: '设备',
      cell: (r) => deviceLabel(r.deviceType),
    },
    {
      key: 'country',
      header: '地区',
      cell: (r) => r.country,
    },
    {
      key: 'landingPath',
      header: '入口页',
      className: 'max-w-[200px] truncate font-mono text-xs',
      cell: (r) => r.landingPath,
    },
    {
      key: 'lastSeenAt',
      header: '最近活跃',
      className: 'whitespace-nowrap text-muted-foreground',
      cell: (r) => formatLastSeen(r.lastSeenAt),
    },
    // 操作列：打开访客档案抽屉查看聊天记录（需 chat.view 权限，数据来自受保护的 chat-rooms 端点）
    ...(canViewChat
      ? [
          {
            key: 'actions' as const,
            header: '操作',
            className: 'w-[80px]',
            cell: (r: AnalyticsVisitorRow) => (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground h-7 gap-1 px-2 text-xs"
                onClick={() => setSheetVisitor(r)}
              >
                <MessagesSquare className="h-3.5 w-3.5" />
                查看对话
              </Button>
            ),
          } satisfies DataTableColumn<AnalyticsVisitorRow>,
        ]
      : []),
  ];

  function resetFilters(f: string, t: string) {
    setFrom(f);
    setTo(t);
    setPage(1);
  }

  return (
    <>
      <PageHeader
        title="访客会话"
        description="同一访客的多次会话已归并为一行（依据持久匿名 ID 与已识别身份）。点击「查看对话」可按人查看其浏览与聊天记录。"
      />

      <Card className="mb-6 border-border/80 py-0 shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <DateRangePicker
            className="h-9 w-[280px]"
            from={from}
            to={to}
            onChange={({ from: f, to: t }) => resetFilters(f, t)}
          />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="搜索姓名/邮箱/电话/公司"
              className="h-9 w-[240px] pl-8"
            />
          </div>
          <p className="text-xs text-muted-foreground">未选日期时默认展示近 7 天。</p>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">访客归并明细</CardTitle>
          <CardDescription>每行代表一个归并后的访客（含其全部会话与页面浏览）。</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <DataTable
              columns={columns}
              rows={data?.data ?? []}
              loading={loading}
              emptyText="暂无访客数据（新版本客户端上线后开始采集）"
            />
          )}
          {data?.pagination ? (
            <TablePagination
              page={page}
              totalPages={data.pagination.totalPages}
              total={data.pagination.total}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          ) : null}
        </CardContent>
      </Card>

      {/* 访客档案抽屉：按人下钻聊天历史（只读） */}
      <VisitorProfileSheet
        visitor={sheetVisitor}
        open={!!sheetVisitor}
        onOpenChange={(v) => {
          if (!v) setSheetVisitor(null);
        }}
      />
    </>
  );
}
