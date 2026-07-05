"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ShieldBan } from "lucide-react";
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
import { RichHint } from "@/components/RichHint";
import { Can } from "@/components/Can";
import { CopyableIp } from "@/components/CopyableText";
import { GPS_GEO_RESOLVE_NOTE } from "@/lib/analytics-geo-hints";
import {
  DEFAULT_PAGE_SORT,
  DEFAULT_REFERRER_SORT,
  DEFAULT_REGION_SORT,
  deviceLabel,
  formatLastSeen,
  useAnalyticsIpTraffic,
  useAnalyticsOverview,
  useAnalyticsPages,
  useAnalyticsReferrers,
  useAnalyticsRegions,
  type AnalyticsPageRow,
  type AnalyticsReferrerRow,
  type AnalyticsRegionRow,
} from "@/features/analytics";
import type { AnalyticsIpTrafficRow } from "@tzj/types";

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

  const [ipTrafficPage, setIpTrafficPage] = useState(1);
  const [ipTrafficPageSize, setIpTrafficPageSize] = useState(10);

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

  const ipTrafficParams = useMemo(
    () => ({
      ...dateParams,
      page: ipTrafficPage,
      limit: ipTrafficPageSize,
    }),
    [dateParams, ipTrafficPage, ipTrafficPageSize],
  );

  const { data, isLoading, isFetching } = useAnalyticsOverview(overviewParams);
  const pagesQuery = useAnalyticsPages(pagesParams);
  const regionsQuery = useAnalyticsRegions(regionsParams);
  const referrersQuery = useAnalyticsReferrers(referrersParams);
  const ipTrafficQuery = useAnalyticsIpTraffic(ipTrafficParams);

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

  const ipTrafficColumns: DataTableColumn<AnalyticsIpTrafficRow>[] = [
    {
      key: "ip",
      header: "IP",
      cell: (r) => <CopyableIp ip={r.ip} ipMasked={r.ipMasked} />,
    },
    {
      key: "region",
      header: "地区",
      cell: (r) => r.region || "—",
    },
    {
      key: "pageViews",
      header: "PV",
      className: "tabular-nums",
      cell: (r) => r.pageViews.toLocaleString("zh-CN"),
    },
    {
      key: "uniqueVisitors",
      header: "UV",
      className: "tabular-nums",
      cell: (r) => r.uniqueVisitors.toLocaleString("zh-CN"),
    },
    {
      key: "lastSeenAt",
      header: "最近访问",
      cell: (r) => formatLastSeen(r.lastSeenAt),
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
      key: "geoSource",
      header: "定位依据",
      sortable: true,
      className: "tabular-nums text-muted-foreground",
      cell: (r) => r.geoSource,
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
      key: "geoSource",
      header: "定位依据",
      sortable: true,
      className: "tabular-nums text-muted-foreground",
      cell: (r) => r.geoSource,
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
    setIpTrafficPage(1);
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
            未选日期时默认展示近 7 天。
          </p>
          <RichHint
            text={GPS_GEO_RESOLVE_NOTE}
            className="w-full text-xs text-muted-foreground"
          />
        </CardContent>
      </Card>

      <Can anyPerm={["security.view", "security.manage"]}>
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

      <div className="mb-6 space-y-2">
        <h2 className="text-base font-semibold">访客 IP</h2>
        <p className="text-xs text-muted-foreground">
          按 IP 聚合的访问明细。完整 IP 自本次升级后的新访问起记录；更早数据可能仅显示脱敏地址。点击 IP 右侧图标可复制。
        </p>
        <DataTable
          columns={ipTrafficColumns}
          rows={ipTrafficQuery.data?.data ?? []}
          loading={ipTrafficQuery.isLoading || ipTrafficQuery.isFetching}
          emptyText="暂无 IP 访问记录"
        />
        {ipTrafficQuery.data?.pagination ? (
          <TablePagination
            page={ipTrafficPage}
            totalPages={ipTrafficQuery.data.pagination.totalPages}
            total={ipTrafficQuery.data.pagination.total}
            pageSize={ipTrafficPageSize}
            onPageChange={setIpTrafficPage}
            onPageSizeChange={(size) => {
              setIpTrafficPageSize(size);
              setIpTrafficPage(1);
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
