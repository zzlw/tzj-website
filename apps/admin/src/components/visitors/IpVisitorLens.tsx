'use client';

/**
 * 访客中心 ·「按 IP」lens：按 IP/网络聚合的访客明细（流量质量 / 地理 / 反刷视角）。
 * 下钻 = IP 浏览时间线 + 关联访客桥（同一 IP 多对多，点击芯片按 visitorId 打开人物抽屉）。
 * 与「按访客」lens 互补：IP 轴看"哪个网络/公司来访"，访客轴看"具体某人的行为与线索"。
 */
import {
  Button,
  Card,
  CardContent,
  DataTable,
  type DataTableColumn,
  TablePagination,
} from '@tzj/ui';
import { Eye } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { deviceColumns } from '@/components/analytics/device-columns';
import { CopyableIp } from '@/components/CopyableText';
import { useVisitorDrawer } from '@/components/visitor-drawer/context';
import { DEVICE_FACET_OPTIONS, SOURCE_FACET_OPTIONS } from '@/components/visitors/facet-options';
import { type FilterFacet, VisitorFilterBar } from '@/components/visitors/VisitorFilterBar';
import {
  type AnalyticsVisitorDetailRow,
  DEFAULT_VISITOR_DETAIL_SORT,
  fetchVisitorDetailsExport,
  formatLastSeen,
  sourceLabel,
  useAnalyticsVisitorDetails,
} from '@/features/analytics';
import { downloadCsv, IP_EXPORT_COLUMNS } from '@/features/analytics-export';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { notifyError, notifySuccess } from '@/lib/notify';
import { intField, sortField, stringField, useUrlState } from '@/lib/use-url-state';

// 访客明细（按 IP 聚合）列定义：模块级工厂，收敛内联 cell 的认知复杂度。
function buildIpDetailColumns(
  onView: (row: AnalyticsVisitorDetailRow) => void,
): DataTableColumn<AnalyticsVisitorDetailRow>[] {
  return [
    {
      key: 'ip',
      header: '访客 IP',
      pinLeft: true,
      cell: (r) => (
        <div className="min-w-0 space-y-0.5">
          <CopyableIp ip={r.ip} ipMasked={r.ipMasked} onActivate={() => onView(r)} />
          <span className="block text-xs text-muted-foreground">定位依据 {r.geoSource}</span>
        </div>
      ),
    },
    {
      key: 'region',
      header: '地区',
      // 展示时按 IP 重解析，服务端排序取入库 country/region/city 近似（同地区有效聚类）
      sortable: true,
      cell: (r) => (
        <div className="min-w-0">
          <span>{r.region || '—'}</span>
          {r.isp ? (
            <span className="block truncate text-xs text-muted-foreground">{r.isp}</span>
          ) : null}
        </div>
      ),
    },
    ...deviceColumns<AnalyticsVisitorDetailRow>(),
    {
      key: 'channel',
      header: '来源渠道',
      // 服务端按首触渠道代表值排序（聚合列 trafficSource）
      sortable: true,
      className: 'max-w-[180px]',
      cell: (r) => (
        <div className="min-w-0">
          <span>{r.channel ? sourceLabel(r.channel) : '—'}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {r.source ? `${r.source}${r.medium ? ` / ${r.medium}` : ''}` : r.referrerHost}
          </span>
        </div>
      ),
    },
    {
      key: 'landingPath',
      header: '落地页',
      className: 'max-w-[200px] truncate font-mono text-xs',
      cell: (r) => r.landingPath ?? '—',
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
      header: '会话',
      sortable: true,
      className: 'tabular-nums',
      cell: (r) => r.sessions.toLocaleString('zh-CN'),
    },
    {
      key: 'lastSeenAt',
      header: '访问时段',
      sortable: true,
      cell: (r) => (
        <div className="min-w-0 text-xs">
          <span className="block text-muted-foreground">首 {formatLastSeen(r.firstSeenAt)}</span>
          <span className="block">近 {formatLastSeen(r.lastSeenAt)}</span>
        </div>
      ),
    },
    // 操作列：打开 IP 访客明细抽屉（浏览时间线 + 关联访客桥）。列较多，固定到右侧防溢出遮挡
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

export function IpVisitorLens({ dateParams }: { dateParams: { from?: string; to?: string } }) {
  const { openIp } = useVisitorDrawer();
  // 搜索/筛选/分页/排序持久化到 URL（prefix `ip_` 与「按访客」lens 隔离键名）。
  const [urlState, setUrl] = useUrlState(
    {
      q: stringField(),
      channel: stringField(),
      deviceType: stringField(),
      page: intField(1, { min: 1 }),
      pageSize: intField(10, { min: 1 }),
      sort: sortField(DEFAULT_VISITOR_DETAIL_SORT),
    },
    { prefix: 'ip_' },
  );
  const { channel, deviceType, page, pageSize } = urlState;
  const sort = urlState.sort;
  const [searchInput, setSearchInput] = useState(() => urlState.q || '');

  // 击键防抖：停止输入 300ms 后才落地检索词
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
      channel: channel || undefined,
      deviceType: deviceType || undefined,
      page,
      limit: pageSize,
      sortBy: sort?.column,
      sortOrder: sort?.order,
    }),
    [dateParams, q, channel, deviceType, page, pageSize, sort],
  );

  const { data, isLoading, isFetching } = useAnalyticsVisitorDetails(params);
  const loading = isLoading || isFetching;
  const rows = data?.data ?? [];

  // 导出：拉取当前筛选下的全量数据（后端上限 5000 行），而非当前页
  const [exporting, setExporting] = useState(false);
  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetchVisitorDetailsExport({
        ...dateParams,
        q: q || undefined,
        channel: channel || undefined,
        deviceType: deviceType || undefined,
        sortBy: sort?.column,
        sortOrder: sort?.order,
      });
      downloadCsv('访客明细_按IP', res.data, IP_EXPORT_COLUMNS);
      notifySuccess(`已导出 ${res.data.length} 条 IP 记录`);
    } catch {
      notifyError('导出失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  }

  // 「查看详情」经全局 Provider 打开 IP 抽屉（桥跳转与栈由 Provider 接管，行数据作 seed 占位）
  const columns = buildIpDetailColumns((row) => openIp(row.id, row));

  // 分面配置：来源渠道 / 设备类型（与后端 query 参数一一对应）
  const facets: FilterFacet[] = [
    {
      key: 'channel',
      label: '来源渠道',
      placeholder: '全部来源渠道',
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
      <CardContent className="space-y-3 pt-6">
        <VisitorFilterBar
          search={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="搜索 IP/地区/城市/浏览器/系统"
          facets={facets}
          onExport={() => void handleExport()}
          exportDisabled={loading || exporting || rows.length === 0}
        />
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyText="暂无访客记录"
          sort={sort}
          defaultSort={DEFAULT_VISITOR_DETAIL_SORT}
          onSortChange={(next) => {
            setUrl({ sort: next, page: 1 });
          }}
        />
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
