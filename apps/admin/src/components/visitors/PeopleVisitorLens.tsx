'use client';

/**
 * 访客中心 ·「按访客」lens：按人聚合（COALESCE(userId, visitorId)）的访客归并明细。
 * 侧重身份 / 意向 / 线索（获客视角）：身份识别、关键页触达、来源归因、最近活跃。
 * 支持按姓名/邮箱/电话/公司搜索；下钻 = 人物档案（浏览行为 + 聊天记录）。
 */
import {
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  type DataTableColumn,
  Skeleton,
  TablePagination,
} from '@tzj/ui';
import { Eye } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { deviceColumns } from '@/components/analytics/device-columns';
import { CopyableIp, CopyableText } from '@/components/CopyableText';
import { useVisitorDrawer } from '@/components/visitor-drawer/context';
import { DEVICE_FACET_OPTIONS, SOURCE_FACET_OPTIONS } from '@/components/visitors/facet-options';
import { type FilterFacet, VisitorFilterBar } from '@/components/visitors/VisitorFilterBar';
import {
  type AnalyticsVisitorRow,
  DEFAULT_VISITORS_SORT,
  formatLastSeen,
  formatTimeOfDay,
  sourceLabel,
  useAnalyticsVisitors,
} from '@/features/analytics';
import { downloadCsv, PEOPLE_EXPORT_COLUMNS } from '@/features/analytics-export';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { intField, sortField, stringField, useUrlState } from '@/lib/use-url-state';

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

/** 来源渠道 + 引荐域名副行（首触归因） */
function SourceCell({ row }: { row: AnalyticsVisitorRow }) {
  return (
    <div className="min-w-[110px]">
      <div className="text-foreground">{row.channel ? sourceLabel(row.channel) : '—'}</div>
      {row.referrerHost ? (
        <div className="mt-0.5 max-w-[160px] truncate text-xs text-muted-foreground">
          {row.referrerHost}
        </div>
      ) : null}
    </div>
  );
}

/** 地区：region · city 优先，回退 country */
function regionText(row: AnalyticsVisitorRow): string {
  const local = [row.region, row.city].filter(Boolean).join(' · ');
  return local || row.country || '—';
}

/** 关键页触达轻标签（企业官网意向轻代理，非打分） */
function KeyPagesCell({ row }: { row: AnalyticsVisitorRow }) {
  if (!row.touchedContact && !row.touchedCase) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {row.touchedContact ? (
        <Badge
          variant="outline"
          className="whitespace-nowrap border-amber-200 bg-amber-50 text-amber-700"
        >
          联系
        </Badge>
      ) : null}
      {row.touchedCase ? (
        <Badge
          variant="outline"
          className="whitespace-nowrap border-sky-200 bg-sky-50 text-sky-700"
        >
          案例
        </Badge>
      ) : null}
    </div>
  );
}

/** 最近活跃时间 + 访问时段 */
function LastSeenCell({ row }: { row: AnalyticsVisitorRow }) {
  return (
    <div className="whitespace-nowrap">
      <div>{formatLastSeen(row.lastSeenAt)}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        {formatTimeOfDay(row.lastSeenAt)}活跃
      </div>
    </div>
  );
}

function buildPeopleColumns(
  onView: (row: AnalyticsVisitorRow) => void,
  onOpenIp: (row: AnalyticsVisitorRow) => void,
): DataTableColumn<AnalyticsVisitorRow>[] {
  return [
    {
      key: 'visitorId',
      header: '访客 ID',
      className: 'whitespace-nowrap',
      pinLeft: true,
      cell: (r) => (
        <CopyableText
          value={r.visitorId}
          display={`#${r.visitorId.slice(0, 8)}`}
          onActivate={() => onView(r)}
        />
      ),
    },
    {
      key: 'identity',
      header: '访客身份',
      cell: (r) => <IdentityCell row={r} />,
    },
    {
      key: 'channel',
      header: '来源',
      cell: (r) => <SourceCell row={r} />,
    },
    ...deviceColumns<AnalyticsVisitorRow>(),
    {
      key: 'region',
      header: '地区',
      className: 'whitespace-nowrap',
      cell: (r) => regionText(r),
    },
    {
      key: 'lastIp',
      header: '最后访问 IP',
      className: 'whitespace-nowrap',
      cell: (r) => (
        <CopyableIp
          ip={r.lastIp}
          ipMasked={r.lastIpMasked}
          onActivate={r.lastIpHash ? () => onOpenIp(r) : undefined}
        />
      ),
    },
    {
      key: 'landingPath',
      header: '入口页',
      className: 'max-w-[180px] truncate font-mono text-xs',
      cell: (r) => r.landingPath,
    },
    {
      key: 'pageViews',
      header: 'PV',
      sortable: true,
      className: 'tabular-nums',
      cell: (r) => r.pageViews.toLocaleString('zh-CN'),
    },
    {
      key: 'sessions',
      header: '访问次数',
      sortable: true,
      className: 'tabular-nums',
      cell: (r) => r.sessions.toLocaleString('zh-CN'),
    },
    {
      key: 'keyPages',
      header: '关键页',
      cell: (r) => <KeyPagesCell row={r} />,
    },
    {
      key: 'lastSeenAt',
      header: '最近活跃',
      sortable: true,
      className: 'text-muted-foreground',
      cell: (r) => <LastSeenCell row={r} />,
    },
    // 操作列：打开访客档案抽屉；列较多时固定到右侧 pinRight，避免横向溢出被遮挡
    {
      key: 'actions',
      header: '操作',
      className: 'w-[92px]',
      pinRight: true,
      cell: (r) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-7 gap-1 px-2 text-xs"
          onClick={() => onView(r)}
        >
          <Eye className="h-3.5 w-3.5" />
          查看详情
        </Button>
      ),
    },
  ];
}

export function PeopleVisitorLens({ dateParams }: { dateParams: { from?: string; to?: string } }) {
  const { openPerson, openIp } = useVisitorDrawer();
  // 搜索/筛选/分页/排序持久化到 URL（prefix `pp_` 与「按 IP」lens 隔离键名）。
  const [urlState, setUrl] = useUrlState(
    {
      q: stringField(),
      identified: stringField(),
      keyPage: stringField(),
      channel: stringField(),
      deviceType: stringField(),
      page: intField(1, { min: 1 }),
      pageSize: intField(10, { min: 1 }),
      sort: sortField(DEFAULT_VISITORS_SORT),
    },
    { prefix: 'pp_' },
  );
  const { identified, keyPage, channel, deviceType, page, pageSize } = urlState;
  const sort = urlState.sort;
  const [searchInput, setSearchInput] = useState(() => urlState.q || '');

  // 击键防抖：停止输入 300ms 后才落地检索词，避免每次输入都打后端
  const q = useDebouncedValue(searchInput.trim(), 300);

  // 防抖后的检索词写入 URL 并回到第一页（跳过首次挂载，避免刷新时清掉 URL 里的 page）
  const qMounted = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 仅在防抖检索词变化时同步
  useEffect(() => {
    if (!qMounted.current) {
      qMounted.current = true;
      return;
    }
    setUrl({ q, page: 1 });
  }, [q]);

  // 日期区间变化时回到第一页（日期在父级独立 URL 态，跨组件复位只能用 effect）
  const dateMounted = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 仅在日期区间变化时重置分页
  useEffect(() => {
    if (!dateMounted.current) {
      dateMounted.current = true;
      return;
    }
    setUrl({ page: 1 });
  }, [dateParams]);

  const params = useMemo(
    () => ({
      ...dateParams,
      q: q || undefined,
      identified: identified || undefined,
      keyPage: keyPage || undefined,
      channel: channel || undefined,
      deviceType: deviceType || undefined,
      page,
      limit: pageSize,
      sortBy: sort?.column,
      sortOrder: sort?.order,
    }),
    [dateParams, q, identified, keyPage, channel, deviceType, page, pageSize, sort],
  );

  const { data, isLoading, isFetching } = useAnalyticsVisitors(params);
  const loading = isLoading || isFetching;
  const rows = data?.data ?? [];
  const columns = buildPeopleColumns(
    (row) => openPerson(row.visitorId, row),
    (row) => {
      if (!row.lastIpHash) return;
      openIp(row.lastIpHash, {
        ip: row.lastIp,
        ipMasked: row.lastIpMasked,
        region: regionText(row),
      });
    },
  );

  // 分面配置：身份状态 / 关键页触达 / 来源渠道 / 设备类型（与后端 query 参数一一对应）
  const facets: FilterFacet[] = [
    {
      key: 'identified',
      label: '身份',
      placeholder: '全部身份',
      value: identified,
      onChange: (v) => setUrl({ identified: v, page: 1 }),
      options: [
        { value: 'true', label: '已识别' },
        { value: 'false', label: '匿名' },
      ],
    },
    {
      key: 'keyPage',
      label: '关键页',
      placeholder: '全部意向',
      value: keyPage,
      onChange: (v) => setUrl({ keyPage: v, page: 1 }),
      triggerClassName: 'w-[140px]',
      options: [
        { value: 'contact', label: '触达联系' },
        { value: 'case', label: '触达案例' },
        { value: 'any', label: '触达任一' },
      ],
    },
    {
      key: 'channel',
      label: '来源',
      placeholder: '全部来源',
      value: channel,
      onChange: (v) => setUrl({ channel: v, page: 1 }),
      options: SOURCE_FACET_OPTIONS,
    },
    {
      key: 'deviceType',
      label: '设备',
      placeholder: '全部设备',
      value: deviceType,
      onChange: (v) => setUrl({ deviceType: v, page: 1 }),
      options: DEVICE_FACET_OPTIONS,
    },
  ];

  return (
    <Card className="border-border/80 shadow-sm">
      <CardContent className="space-y-4 pt-6">
        <VisitorFilterBar
          search={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="搜索姓名/邮箱/电话/公司/访客ID/地区"
          facets={facets}
          onExport={() => downloadCsv('访客明细_按访客', rows, PEOPLE_EXPORT_COLUMNS)}
          exportDisabled={loading || rows.length === 0}
        />
        {loading && !data ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            loading={loading}
            emptyText="暂无访客数据（新版本客户端上线后开始采集）"
            sort={sort}
            defaultSort={DEFAULT_VISITORS_SORT}
            onSortChange={(next) => {
              setUrl({ sort: next, page: 1 });
            }}
          />
        )}
        {data?.pagination ? (
          <TablePagination
            page={page}
            totalPages={data.pagination.totalPages}
            total={data.pagination.total}
            pageSize={pageSize}
            onPageChange={(p) => setUrl({ page: p })}
            onPageSizeChange={(size) => {
              setUrl({ pageSize: size, page: 1 });
            }}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
