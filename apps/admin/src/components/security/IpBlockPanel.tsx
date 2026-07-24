'use client';

import type { AnalyticsIpTrafficRow, BlockedIpItem, BlockIpDuration } from '@tzj/types';
import {
  Button,
  DataTable,
  type DataTableColumn,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TablePagination,
  Textarea,
} from '@tzj/ui';
import { Ban, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Can } from '@/components/Can';
import { CopyableIp, CopyableText } from '@/components/CopyableText';
import {
  BLOCK_DURATION_OPTIONS,
  formatBlockedExpiry,
  formatLastSeen,
  useBlockedIps,
  useBlockIp,
  useSecurityIpTraffic,
  useUnblockIp,
} from '@/features/security-ip-block';
import { notifyError, notifySuccess } from '@/lib/notify';
import { intField, useUrlState } from '@/lib/use-url-state';

const IP_TRAFFIC_TOP = 100;

function BlockIpForm({ hint, onSuccess }: { hint?: string; onSuccess?: () => void }) {
  const blockMut = useBlockIp();
  const [ip, setIp] = useState('');
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState<BlockIpDuration>('7d');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ip.trim()) {
      notifyError('请输入 IP 地址');
      return;
    }
    try {
      await blockMut.mutateAsync({
        ip: ip.trim(),
        reason: reason.trim() || undefined,
        duration,
      });
      notifySuccess('IP 已封禁，后续访问将被静默拒绝');
      setIp('');
      setReason('');
      setDuration('7d');
      onSuccess?.();
    } catch (err) {
      notifyError(err, '封禁失败');
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border bg-muted/20 p-4">
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="block-ip">IP 地址</Label>
          <Input
            id="block-ip"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="例如 203.0.113.42"
            className="mt-1.5 font-mono"
            autoComplete="off"
          />
        </div>
        <div>
          <Label htmlFor="block-duration">封禁时长</Label>
          <Select value={duration} onValueChange={(v) => setDuration(v as BlockIpDuration)}>
            <SelectTrigger id="block-duration" className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BLOCK_DURATION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="block-reason">封禁原因（可选）</Label>
        <Textarea
          id="block-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="如：异常刷量、恶意爬虫"
          className="mt-1.5 min-h-[72px]"
        />
      </div>
      <Button type="submit" disabled={blockMut.isPending}>
        {blockMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        <Ban className="mr-2 h-4 w-4" />
        封禁 IP
      </Button>
    </form>
  );
}

export function IpBlockPanel({ from, to }: { from?: string; to?: string }) {
  // 双表分页持久化到 URL（bp/bl = blocked，tp/tl = traffic，键名互不冲突）
  const [urlState, setUrl] = useUrlState({
    blockedPage: intField(1, { min: 1 }),
    blockedPageSize: intField(10, { min: 1 }),
    trafficPage: intField(1, { min: 1 }),
    trafficPageSize: intField(10, { min: 1 }),
  });
  const { blockedPage, blockedPageSize, trafficPage, trafficPageSize } = urlState;
  const [blockHint, setBlockHint] = useState<string | undefined>();

  // 日期区间变化时高频 IP 表回到第一页（跳过首次挂载，避免刷新时清掉 URL 里的页码）
  const dateMounted = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 仅在日期区间变化时重置分页
  useEffect(() => {
    if (!dateMounted.current) {
      dateMounted.current = true;
      return;
    }
    setUrl({ trafficPage: 1 });
  }, [from, to]);

  const blockedParams = useMemo(
    () => ({ page: blockedPage, limit: blockedPageSize }),
    [blockedPage, blockedPageSize],
  );

  const trafficParams = useMemo(
    () => ({
      from,
      to,
      page: trafficPage,
      limit: trafficPageSize,
      top: IP_TRAFFIC_TOP,
    }),
    [from, to, trafficPage, trafficPageSize],
  );

  const blockedQuery = useBlockedIps(blockedParams);
  const trafficQuery = useSecurityIpTraffic(trafficParams);
  const unblockMut = useUnblockIp();

  const trafficColumns: DataTableColumn<AnalyticsIpTrafficRow>[] = [
    {
      key: 'ip',
      header: 'IP',
      cell: (row) => <CopyableIp ip={row.ip} ipMasked={row.ipMasked} />,
    },
    { key: 'region', header: '地区', cell: (row) => row.region || '—' },
    {
      key: 'pageViews',
      header: 'PV',
      cell: (row) => row.pageViews.toLocaleString(),
      sortable: false,
    },
    {
      key: 'uniqueVisitors',
      header: 'UV',
      cell: (row) => row.uniqueVisitors.toLocaleString(),
      sortable: false,
    },
    {
      key: 'lastSeenAt',
      header: '最近访问',
      cell: (row) => formatLastSeen(row.lastSeenAt),
      sortable: false,
    },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <Can perm="security.manage">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const label = row.ip ?? row.ipMasked ?? '—';
              setBlockHint(
                `IP ${label}（${row.region || '未知地区'}，PV ${row.pageViews}）。确认后可直接封禁，或修改上方表单。`,
              );
            }}
          >
            封禁
          </Button>
        </Can>
      ),
      sortable: false,
    },
  ];

  const blockedColumns: DataTableColumn<BlockedIpItem>[] = [
    {
      key: 'ipMasked',
      header: 'IP',
      cell: (row) => <CopyableText value={row.ipMasked} />,
    },
    {
      key: 'reason',
      header: '原因',
      cell: (row) => row.reason || '—',
    },
    {
      key: 'expires',
      header: '到期',
      cell: (row) => formatBlockedExpiry(row),
    },
    {
      key: 'createdBy',
      header: '操作人',
      cell: (row) => row.createdBy?.nickname || row.createdBy?.username || '—',
    },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <Can perm="security.manage">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={unblockMut.isPending}
            onClick={async () => {
              try {
                await unblockMut.mutateAsync(row.id);
                notifySuccess('已解除封禁');
              } catch (err) {
                notifyError(err, '解封失败');
              }
            }}
          >
            解封
          </Button>
        </Can>
      ),
      sortable: false,
    },
  ];

  return (
    <div className="space-y-6">
      <Can perm="security.manage">
        <BlockIpForm hint={blockHint} onSuccess={() => setBlockHint(undefined)} />
      </Can>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">已封禁 IP</h3>
        <DataTable
          columns={blockedColumns}
          rows={blockedQuery.data?.data ?? []}
          loading={blockedQuery.isLoading || blockedQuery.isFetching}
          emptyText="暂无封禁记录"
        />
        {blockedQuery.data?.pagination ? (
          <TablePagination
            page={blockedPage}
            totalPages={blockedQuery.data.pagination.totalPages}
            total={blockedQuery.data.pagination.total}
            pageSize={blockedPageSize}
            onPageChange={(p) => setUrl({ blockedPage: p })}
            onPageSizeChange={(size) => {
              setUrl({ blockedPageSize: size, blockedPage: 1 });
            }}
          />
        ) : null}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">高频 IP（当前时段 Top {IP_TRAFFIC_TOP}）</h3>
        <p className="text-xs text-muted-foreground">
          数据来自访客分析采集，按 PV 降序取前 {IP_TRAFFIC_TOP} 名。封禁时需输入完整
          IP（可从列表复制）。
        </p>
        <DataTable
          columns={trafficColumns}
          rows={trafficQuery.data?.data ?? []}
          loading={trafficQuery.isLoading || trafficQuery.isFetching}
          emptyText="暂无 IP 流量数据"
        />
        {trafficQuery.data?.pagination ? (
          <TablePagination
            page={trafficPage}
            totalPages={trafficQuery.data.pagination.totalPages}
            total={trafficQuery.data.pagination.total}
            pageSize={trafficPageSize}
            onPageChange={(p) => setUrl({ trafficPage: p })}
            onPageSizeChange={(size) => {
              setUrl({ trafficPageSize: size, trafficPage: 1 });
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
