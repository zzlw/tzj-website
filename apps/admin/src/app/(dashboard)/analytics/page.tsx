'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  DataTable,
  type DataTableColumn,
  DateRangePicker,
  PageHeader,
  Skeleton,
  TablePagination,
} from '@tzj/ui';
import { ArrowRight, ShieldBan } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { DonutChart, HorizontalBarChart, TrendChart } from '@/components/analytics/AnalyticsCharts';
import { Can } from '@/components/Can';
import { RichHint } from '@/components/RichHint';
import {
  type AnalyticsOverview,
  type AnalyticsPageRow,
  DEFAULT_PAGE_SORT,
  deviceLabel,
  sourceLabel,
  useAnalyticsOverview,
  useAnalyticsPages,
  useAnalyticsSources,
} from '@/features/analytics';
import { GPS_GEO_RESOLVE_NOTE } from '@/lib/analytics-geo-hints';
import {
  allowedGranularities,
  defaultGranularity,
  GRANULARITIES,
  GRANULARITY_LABELS,
  type Granularity,
  resolveGranularity,
} from '@/lib/analytics-granularity';
import {
  BROWSER_SUPPORT_LABELS,
  type BrowserSupportStatus,
  classifyBrowserSupport,
} from '@/lib/browser-support';
import { WEB_BASE } from '@/lib/config';
import { intField, sortField, stringField, useUrlState } from '@/lib/use-url-state';

// 兼容性分布配色：与访客表格「兼容性」列徽标同调（支持=绿 / 不支持=红 / 未知=灰）。
const SUPPORT_CHART_COLOR: Record<BrowserSupportStatus, string> = {
  supported: '#10b981',
  unsupported: '#f43f5e',
  unknown: '#94a3b8',
};

function StatCard({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value: number;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">
          {loading ? <Skeleton className="h-9 w-20" /> : value.toLocaleString('zh-CN')}
        </CardTitle>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardHeader>
    </Card>
  );
}

// 热门页面明细列（静态无依赖）：提到模块级以免抬高 AnalyticsPage 复杂度。
const PAGE_COLUMNS: DataTableColumn<AnalyticsPageRow>[] = [
  {
    key: 'path',
    header: '页面路径',
    sortable: true,
    className: 'max-w-[240px] font-mono text-xs',
    // 路径即前台 C 端路由：渲染为新开页链接，直达官网对应页面（复用 WEB_BASE 前台基址）
    cell: (r) => (
      <a
        href={`${WEB_BASE}${r.path}`}
        target="_blank"
        rel="noopener noreferrer"
        title={r.path}
        className="block truncate text-primary hover:underline"
      >
        {r.path}
      </a>
    ),
  },
  {
    key: 'title',
    header: '标题',
    sortable: true,
    className: 'max-w-[200px] truncate text-muted-foreground',
    cell: (r) => r.title ?? '—',
  },
  {
    key: 'pageViews',
    header: 'PV',
    sortable: true,
    className: 'tabular-nums',
    cell: (r) => r.pageViews.toLocaleString('zh-CN'),
  },
  {
    key: 'uniqueVisitors',
    header: 'UV',
    sortable: true,
    className: 'tabular-nums',
    cell: (r) => r.uniqueVisitors.toLocaleString('zh-CN'),
  },
];

// 概览图表数据派生：抽为纯函数，收敛 AnalyticsPage 内多段 map/?? 的复杂度。
function buildOverviewChartData(data: AnalyticsOverview | undefined) {
  return {
    deviceChartData: (data?.devices ?? []).map((d) => ({
      name: deviceLabel(d.deviceType),
      value: d.count,
    })),
    browserChartData: (data?.browsers ?? []).map((b) => ({
      name: b.browser,
      value: b.count,
    })),
    regionChartData: (data?.topRegions ?? []).map((r) => ({
      name: r.region,
      value: r.pageViews,
    })),
    pageChartData: (data?.topPages ?? []).slice(0, 8).map((p) => ({
      name: p.path.length > 28 ? `${p.path.slice(0, 26)}…` : p.path,
      value: p.pageViews,
    })),
    // 浏览器兼容性分布：按版本级明细离线归类为 支持/不支持/未知（口径同访客表「兼容性」列）。
    browserSupportChartData: buildBrowserSupportData(data?.browserVersions ?? []),
  };
}

// 兼容性挡位汇总：将版本级明细按 classifyBrowserSupport 归类并累加 PV，固定排序 + 语义色。
function buildBrowserSupportData(
  rows: NonNullable<AnalyticsOverview['browserVersions']>,
): Array<{ name: string; value: number; color: string }> {
  const buckets: Record<BrowserSupportStatus, number> = {
    supported: 0,
    unsupported: 0,
    unknown: 0,
  };
  for (const row of rows) {
    const { status } = classifyBrowserSupport(row.browser, row.browserVersion);
    buckets[status] += row.count;
  }
  const order: BrowserSupportStatus[] = ['supported', 'unsupported', 'unknown'];
  return order
    .filter((status) => buckets[status] > 0)
    .map((status) => ({
      name: BROWSER_SUPPORT_LABELS[status],
      value: buckets[status],
      color: SUPPORT_CHART_COLOR[status],
    }));
}

// 营销归因分区：自含数据拉取与渲染，避免抬高 AnalyticsPage 复杂度
function SourcesSection({ params }: { params: { from?: string; to?: string } }) {
  const sourcesQuery = useAnalyticsSources(params);
  const loading = sourcesQuery.isLoading || sourcesQuery.isFetching;

  const channelChartData = (sourcesQuery.data?.channels ?? []).map((c) => ({
    name: sourceLabel(c.source),
    value: c.pageViews,
  }));

  const campaignRows = (sourcesQuery.data?.topCampaigns ?? []).map((c) => ({
    id: `${c.campaign}|${c.source}|${c.medium}`,
    campaign: c.campaign,
    source: c.source,
    medium: c.medium,
    pageViews: c.pageViews,
    uniqueVisitors: c.uniqueVisitors,
  }));

  const campaignColumns: DataTableColumn<(typeof campaignRows)[number]>[] = [
    {
      key: 'campaign',
      header: '广告系列',
      className: 'max-w-[220px] truncate font-medium',
      cell: (r) => r.campaign,
    },
    {
      key: 'source',
      header: '来源 · 媒介',
      className: 'text-muted-foreground',
      cell: (r) => `${r.source} / ${r.medium}`,
    },
    {
      key: 'pageViews',
      header: 'PV',
      className: 'tabular-nums',
      cell: (r) => r.pageViews.toLocaleString('zh-CN'),
    },
    {
      key: 'uniqueVisitors',
      header: 'UV',
      className: 'tabular-nums',
      cell: (r) => r.uniqueVisitors.toLocaleString('zh-CN'),
    },
  ];

  return (
    <div className="mb-6 grid gap-6 lg:grid-cols-2">
      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">流量来源</CardTitle>
          <CardDescription>按渠道分组（UTM 媒介 / gclid / 引荐域名推断）的 PV 占比</CardDescription>
        </CardHeader>
        <CardContent>
          <DonutChart items={channelChartData} loading={loading} emptyText="暂无来源数据" />
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">热门广告系列</CardTitle>
          <CardDescription>带 utm_campaign 标记的访问排行（Top 15）</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={campaignColumns}
            rows={campaignRows}
            loading={loading}
            emptyText="暂无带 UTM 标记的访问"
          />
        </CardContent>
      </Card>
    </div>
  );
}

// 趋势图粒度切换（segmented control，卡片头右上角）：非法粒度置灰，激活项高亮。
// 与顶部日期范围正交——范围决定「看多久」，粒度决定「按什么聚合」。
function GranularitySwitch({
  value,
  from,
  to,
  onChange,
}: {
  value: Granularity;
  from?: string;
  to?: string;
  onChange: (g: Granularity) => void;
}) {
  const allowed = allowedGranularities(from, to);
  return (
    <div className="inline-flex items-center rounded-md border border-border bg-muted/40 p-0.5">
      {GRANULARITIES.map((g) => {
        const disabled = !allowed.includes(g);
        const active = g === value;
        return (
          <button
            key={g}
            type="button"
            disabled={disabled}
            onClick={() => onChange(g)}
            title={disabled ? '当前日期范围不适用该粒度' : undefined}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
              disabled && 'cursor-not-allowed opacity-40 hover:text-muted-foreground',
            )}
          >
            {GRANULARITY_LABELS[g]}
          </button>
        );
      })}
    </div>
  );
}

export default function AnalyticsPage() {
  const [dateState, setDate] = useUrlState({
    from: stringField(),
    to: stringField(),
    g: stringField(),
  });
  const from = dateState.from;
  const to = dateState.to;
  // 后端为权威，但前端先按同一阈值解析出实际粒度：驱动请求参数、控件高亮与横轴标签。
  const granularity = resolveGranularity(dateState.g, from, to);

  const [pagesState, setPages] = useUrlState(
    {
      page: intField(1, { min: 1 }),
      pageSize: intField(10, { min: 1 }),
      sort: sortField(DEFAULT_PAGE_SORT),
    },
    { prefix: 'p' },
  );
  const pagesPage = pagesState.page;
  const pagesPageSize = pagesState.pageSize;
  const pagesSort = pagesState.sort;

  const dateParams = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
    }),
    [from, to],
  );

  const overviewParams = useMemo(() => ({ ...dateParams, granularity }), [dateParams, granularity]);

  const pagesParams = useMemo(
    () => ({
      ...dateParams,
      page: pagesPage,
      limit: pagesPageSize,
      sortBy: pagesSort?.column,
      sortOrder: pagesSort?.order,
    }),
    [dateParams, pagesPage, pagesPageSize, pagesSort],
  );

  const { data, isLoading, isFetching } = useAnalyticsOverview(overviewParams);
  const pagesQuery = useAnalyticsPages(pagesParams);

  const overviewLoading = isLoading || isFetching;

  const {
    deviceChartData,
    browserChartData,
    regionChartData,
    pageChartData,
    browserSupportChartData,
  } = buildOverviewChartData(data);

  function resetDateFilters(f: string, t: string) {
    setDate({ from: f, to: t });
    setPages({ page: 1 });
  }

  return (
    <>
      <PageHeader
        title="访客分析"
        description="官网 C 端访问统计：页面浏览量、独立访客、热门页面与来源（first-party，隐私友好）。"
      />

      <Card className="mb-6 border-border/80 py-0 shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <DateRangePicker
            className="h-9 w-[280px]"
            from={from}
            to={to}
            onChange={({ from: f, to: t }) => resetDateFilters(f, t)}
          />
          <p className="text-xs text-muted-foreground">未选日期时默认展示近 7 天。</p>
          <RichHint text={GPS_GEO_RESOLVE_NOTE} className="w-full text-xs text-muted-foreground" />
        </CardContent>
      </Card>

      <Can anyPerm={['security.view', 'security.manage']}>
        <Card className="mb-6 border-border/80 shadow-sm">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <ShieldBan className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">发现异常 IP 刷量？</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  访客分析为只读统计。封禁 IP 属于访问控制，请在网站安全中处置。
                </p>
              </div>
            </div>
            <Link
              href="/security/ip-block"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              前往 IP 封禁
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </Can>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="今日 PV"
          value={data?.summary.pageViewsToday ?? 0}
          loading={overviewLoading}
        />
        <StatCard
          label="今日 UV"
          value={data?.summary.uniqueVisitorsToday ?? 0}
          loading={overviewLoading}
        />
        <StatCard
          label="时段 PV"
          value={data?.summary.pageViews ?? 0}
          hint={from && to ? `${from} ~ ${to}` : '近 7 天'}
          loading={overviewLoading}
        />
        <StatCard
          label="时段 UV"
          value={data?.summary.uniqueVisitors ?? 0}
          loading={overviewLoading}
        />
      </div>

      <Card className="mb-6 border-border/80 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="text-base">访问趋势</CardTitle>
            <CardDescription>
              {GRANULARITY_LABELS[granularity]} PV（面积）与 UV（折线）对比
            </CardDescription>
          </div>
          <GranularitySwitch
            value={granularity}
            from={from}
            to={to}
            onChange={(g) => setDate({ g: g === defaultGranularity(from, to) ? '' : g })}
          />
        </CardHeader>
        <CardContent>
          <TrendChart
            daily={data?.daily ?? []}
            granularity={granularity}
            loading={overviewLoading}
          />
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">访客地区</CardTitle>
            <CardDescription>
              按 IP 或 GPS 解析的地理分布（Top 12）。GPS 模式详见上方逆地理说明。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart
              items={regionChartData}
              loading={overviewLoading}
              emptyText="暂无地区数据"
            />
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">热门页面</CardTitle>
            <CardDescription>访问量最高的页面路径（Top 8）</CardDescription>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart
              items={pageChartData}
              loading={overviewLoading}
              emptyText="暂无页面访问记录"
            />
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">设备分布</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart items={deviceChartData} loading={overviewLoading} />
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">浏览器分布</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart items={browserChartData} loading={overviewLoading} />
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">浏览器兼容性分布</CardTitle>
            <CardDescription>
              按 ES2020 基线归类（口径同前台升级横条）：不支持占比偏高时需关注兼容降级。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChart
              items={browserSupportChartData}
              loading={overviewLoading}
              emptyText="暂无浏览器版本数据"
            />
          </CardContent>
        </Card>
      </div>

      <SourcesSection params={dateParams} />

      <div className="mb-6 space-y-2">
        <h2 className="text-base font-semibold">热门页面明细</h2>
        <DataTable
          columns={PAGE_COLUMNS}
          rows={pagesQuery.data?.data ?? []}
          loading={pagesQuery.isLoading || pagesQuery.isFetching}
          emptyText="暂无页面访问记录"
          sort={pagesSort}
          defaultSort={DEFAULT_PAGE_SORT}
          onSortChange={(next) => {
            setPages({ sort: next, page: 1 });
          }}
        />
        {pagesQuery.data?.pagination ? (
          <TablePagination
            page={pagesPage}
            totalPages={pagesQuery.data.pagination.totalPages}
            total={pagesQuery.data.pagination.total}
            pageSize={pagesPageSize}
            onPageChange={(p) => setPages({ page: p })}
            onPageSizeChange={(size) => {
              setPages({ pageSize: size, page: 1 });
            }}
          />
        ) : null}
      </div>
    </>
  );
}
