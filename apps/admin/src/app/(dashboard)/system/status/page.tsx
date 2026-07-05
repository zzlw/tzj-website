"use client";

import { Loader2, RefreshCw, Server } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@tzj/ui";
import {
  DEPENDENCY_LABELS,
  dependencyStatusClass,
  dependencyStatusLabel,
  formatUptime,
  useSystemStatus,
} from "@/features/system-status";
import { formatDateTime } from "@/features/constants";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    healthy: { label: "健康", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    degraded: { label: "降级", className: "bg-amber-50 text-amber-700 border-amber-200" },
    down: { label: "故障", className: "bg-red-50 text-red-700 border-red-200" },
  };
  const item = map[status] ?? { label: status, className: "" };
  return (
    <Badge variant="outline" className={item.className}>
      {item.label}
    </Badge>
  );
}

function MeterBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export default function SystemStatusPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useSystemStatus();

  if (isLoading || !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "加载失败"}
      </p>
    );
  }

  const memUsedPercent = data.process.memory.heapTotalMb
    ? Math.round((data.process.memory.heapUsedMb / data.process.memory.heapTotalMb) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="系统状态"
        description="API 进程资源与依赖服务健康摘要。生产环境建议配合 Prometheus/Grafana 做完整监控与告警。"
        action={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            刷新
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>整体状态</CardDescription>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Server className="h-4 w-4 text-muted-foreground" />
              API 服务
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatusBadge status={data.status} />
            <p className="text-xs text-muted-foreground">版本 v{data.version}</p>
            <p className="text-xs text-muted-foreground">
              运行 {formatUptime(data.uptime)} · Node {data.process.nodeVersion}
            </p>
            <p className="text-xs text-muted-foreground">
              更新于 {formatDateTime(data.timestamp)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>进程内存</CardDescription>
            <CardTitle className="text-lg">堆内存</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold">
              {data.process.memory.heapUsedMb}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                / {data.process.memory.heapTotalMb} MB
              </span>
            </p>
            <MeterBar value={memUsedPercent} />
            <p className="text-xs text-muted-foreground">
              RSS {data.process.memory.rssMb} MB · PID {data.process.pid}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>CPU 负载（1/5/15 分钟）</CardDescription>
            <CardTitle className="text-lg">系统负载</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.process.cpu.loadAvg1m}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.process.cpu.loadAvg5m} · {data.process.cpu.loadAvg15m}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              容器/单机部署下为宿主机负载均值，K8s 多副本时仅供参考。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>磁盘（数据目录）</CardDescription>
            <CardTitle className="text-lg">存储空间</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.disk ? (
              <>
                <p className="text-2xl font-semibold">{data.disk.usedPercent}%</p>
                <MeterBar value={data.disk.usedPercent} />
                <p className="text-xs text-muted-foreground">
                  剩余 {data.disk.freeGb} GB / 共 {data.disk.totalGb} GB
                </p>
                <p className="truncate text-xs text-muted-foreground" title={data.disk.path}>
                  {data.disk.path}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">当前环境无法读取磁盘信息</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">依赖服务</CardTitle>
          <CardDescription>
            对应 API <code className="text-xs">/health/ready</code> 探针结果
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.entries(data.dependencies) as [keyof typeof data.dependencies, string][]).map(
              ([key, status]) => (
                <li
                  key={key}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 ${dependencyStatusClass(status)}`}
                >
                  <span className="text-sm font-medium">{DEPENDENCY_LABELS[key]}</span>
                  <span className="text-sm">{dependencyStatusLabel(status)}</span>
                </li>
              ),
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
