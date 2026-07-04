"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  type DataTableColumn,
  type DataTableSort,
  DateRangePicker,
  PageHeader,
  Skeleton,
  TablePagination,
} from "@tzj/ui";
import {
  DonutChart,
  HorizontalBarChart,
  TrendChart,
} from "@/components/analytics/AnalyticsCharts";
import {
  DEFAULT_PAGE_SORT,
  DEFAULT_REFERRER_SORT,
  DEFAULT_REGION_SORT,
  deviceLabel,
  useAnalyticsOverview,
  useAnalyticsPages,
  useAnalyticsReferrers,
  useAnalyticsRegions,
  type AnalyticsPageRow,
  type AnalyticsReferrerRow,
  type AnalyticsRegionRow,
} from "@/features/analytics";

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
          {loading ? <Skeleton className="h-9 w-20" /> : value.toLocaleString("zh-CN")}
        </CardTitle>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardHeader>
    </Card>
  );
}

export default function AnalyticsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [pagesPage, setPagesPage] = useState(1);
  const [pagesPageSize, setPagesPageSize] = useState(10);
  const [pagesSort, setPagesSort] = useState<DataTableSort | null>(DEFAULT_PAGE_SORT);

  const [regionsPage, setRegionsPage] = useState(1);
  const [regionsPageSize, setRegionsPageSize] = useState(10);
  const [regionsSort, setRegionsSort] = useState<DataTableSort | null>(DEFAULT_REGION_SORT);

  const [referrersPage, setReferrersPage] = useState(1);
  const [referrersPageSize, setReferrersPageSize] = useState(10);
  const [referrersSort, setReferrersSort] = useState<DataTableSort | null>(
    DEFAULT_REFERRER_SORT,
  );

  const dateParams = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
    }),
    [from, to],
  );

  const overviewParams = dateParams;

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

  const regionsParams = useMemo(
    () => ({
      ...dateParams,
      page: regionsPage,
      limit: regionsPageSize,
      sortBy: regionsSort?.column,
      sortOrder: regionsSort?.order,
    }),
    [dateParams, regionsPage, regionsPageSize, regionsSort],
  );

  const referrersParams = useMemo(
    () => ({
      ...dateParams,
      page: referrersPage,
      limit: referrersPageSize,
      sortBy: referrersSort?.column,
      sortOrder: referrersSort?.order,
    }),
    [dateParams, referrersPage, referrersPageSize, referrersSort],
  );

  const { data, isLoading, isFetching } = useAnalyticsOverview(overviewParams);
  const pagesQuery = useAnalyticsPages(pagesParams);
  const regionsQuery = useAnalyticsRegions(regionsParams);
  const referrersQuery = useAnalyticsReferrers(referrersParams);

  const overviewLoading = isLoading || isFetching;

  const pageColumns: DataTableColumn<AnalyticsPageRow>[] = [
    {
      key: "path",
      header: "页面路径",
      sortable: true,
      className: "max-w-[240px] truncate font-mono text-xs",
      cell: (r) => r.path,
    },
    {
      key: "title",
      header: "标题",
      sortable: true,
      className: "max-w-[200px] truncate text-muted-foreground",
      cell: (r) => r.title ?? "—",
    },
    {
      key: "pageViews",
      header: "PV",
      sortable: true,
      className: "tabular-nums",
      cell: (r) => r.pageViews.toLocaleString("zh-CN"),
    },
    {
      key: "uniqueVisitors",
      header: "UV",
      sortable: true,
      className: "tabular-nums",
      cell: (r) => r.uniqueVisitors.toLocaleString("zh-CN"),
    },
  ];

  const referrerColumns: DataTableColumn<AnalyticsReferrerRow>[] = [
    {
      key: "referrerHost",
      header: "来源域名",
      sortable: true,
      cell: (r) => r.referrerHost,
    },
    {
      key: "region",
      header: "地区",
      sortable: true,
      cell: (r) => r.region,
    },
    {
      key: "pageViews",
      header: "PV",
      sortable: true,
      className: "tabular-nums",
      cell: (r) => r.pageViews.toLocaleString("zh-CN"),
    },
  ];

  const regionColumns: DataTableColumn<AnalyticsRegionRow>[] = [
    {
      key: "region",
      header: "地区",
      sortable: true,
      cell: (r) => r.region,
    },
    {
      key: "pageViews",
      header: "PV",
      sortable: true,
      className: "tabular-nums",
      cell: (r) => r.pageViews.toLocaleString("zh-CN"),
    },
    {
      key: "uniqueVisitors",
      header: "UV",
      sortable: true,
      className: "tabular-nums",
      cell: (r) => r.uniqueVisitors.toLocaleString("zh-CN"),
    },
  ];

  const deviceChartData = (data?.devices ?? []).map((d) => ({
    name: deviceLabel(d.deviceType),
    value: d.count,
  }));

  const browserChartData = (data?.browsers ?? []).map((b) => ({
    name: b.browser,
    value: b.count,
  }));

  const regionChartData = (data?.topRegions ?? []).map((r) => ({
    name: r.region,
    value: r.pageViews,
  }));

  const pageChartData = (data?.topPages ?? []).slice(0, 8).map((p) => ({
    name: p.path.length > 28 ? `${p.path.slice(0, 26)}…` : p.path,
    value: p.pageViews,
  }));

  function resetDateFilters(f: string, t: string) {
    setFrom(f);
    setTo(t);
    setPagesPage(1);
    setRegionsPage(1);
    setReferrersPage(1);
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
          <p className="text-xs text-muted-foreground">
            未选日期时默认展示近 7 天；地区数据自本次升级后新产生的访问起记录。
          </p>
        </CardContent>
      </Card>

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
          hint={from && to ? `${from} ~ ${to}` : "近 7 天"}
          loading={overviewLoading}
        />
        <StatCard
          label="时段 UV"
          value={data?.summary.uniqueVisitors ?? 0}
          loading={overviewLoading}
        />
      </div>

      <Card className="mb-6 border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">访问趋势</CardTitle>
          <CardDescription>按日 PV（面积）与 UV（折线）对比</CardDescription>
        </CardHeader>
        <CardContent>
          <TrendChart daily={data?.daily ?? []} loading={overviewLoading} />
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">访客地区</CardTitle>
            <CardDescription>按 IP 离线解析的地理分布（Top 12）</CardDescription>
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

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
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
      </div>

      <div className="mb-6 space-y-2">
        <h2 className="text-base font-semibold">热门页面明细</h2>
        <DataTable
          columns={pageColumns}
          rows={pagesQuery.data?.data ?? []}
          loading={pagesQuery.isLoading || pagesQuery.isFetching}
          emptyText="暂无页面访问记录"
          sort={pagesSort}
          defaultSort={DEFAULT_PAGE_SORT}
          onSortChange={(next) => {
            setPagesPage(1);
            setPagesSort(next);
          }}
        />
        {pagesQuery.data?.pagination ? (
          <TablePagination
            page={pagesPage}
            totalPages={pagesQuery.data.pagination.totalPages}
            total={pagesQuery.data.pagination.total}
            pageSize={pagesPageSize}
            onPageChange={setPagesPage}
            onPageSizeChange={(size) => {
              setPagesPageSize(size);
              setPagesPage(1);
            }}
          />
        ) : null}
      </div>

      <div className="mb-6 space-y-2">
        <h2 className="text-base font-semibold">访客地区明细</h2>
        <DataTable
          columns={regionColumns}
          rows={regionsQuery.data?.data ?? []}
          loading={regionsQuery.isLoading || regionsQuery.isFetching}
          emptyText="暂无地区数据"
          sort={regionsSort}
          defaultSort={DEFAULT_REGION_SORT}
          onSortChange={(next) => {
            setRegionsPage(1);
            setRegionsSort(next);
          }}
        />
        {regionsQuery.data?.pagination ? (
          <TablePagination
            page={regionsPage}
            totalPages={regionsQuery.data.pagination.totalPages}
            total={regionsQuery.data.pagination.total}
            pageSize={regionsPageSize}
            onPageChange={setRegionsPage}
            onPageSizeChange={(size) => {
              setRegionsPageSize(size);
              setRegionsPage(1);
            }}
          />
        ) : null}
      </div>

      <div className="space-y-2">
        <h2 className="text-base font-semibold">流量来源（Referrer）</h2>
        <DataTable
          columns={referrerColumns}
          rows={referrersQuery.data?.data ?? []}
          loading={referrersQuery.isLoading || referrersQuery.isFetching}
          emptyText="暂无外部来源（直接访问不记录 referrer）"
          sort={referrersSort}
          defaultSort={DEFAULT_REFERRER_SORT}
          onSortChange={(next) => {
            setReferrersPage(1);
            setReferrersSort(next);
          }}
        />
        {referrersQuery.data?.pagination ? (
          <TablePagination
            page={referrersPage}
            totalPages={referrersQuery.data.pagination.totalPages}
            total={referrersQuery.data.pagination.total}
            pageSize={referrersPageSize}
            onPageChange={setReferrersPage}
            onPageSizeChange={(size) => {
              setReferrersPageSize(size);
              setReferrersPage(1);
            }}
          />
        ) : null}
      </div>
    </>
  );
}
