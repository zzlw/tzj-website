'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@tzj/ui';
import { Hand, Trash2, Undo2, Upload, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CopyableText } from '@/components/CopyableText';
import { ResourceListView } from '@/components/crud/ResourceListView';
import { ImportCustomersDialog } from '@/components/customers/ImportCustomersDialog';
import { useSession } from '@/components/session';
import { useVisitorDrawer } from '@/components/visitor-drawer/context';
import { customersConfig } from '@/features/resources/customers';
import type { CustomerItem } from '@/features/types';
import { api } from '@/lib/apiClient';
import { notifyError, notifySuccess } from '@/lib/notify';

type Agent = { id: string; username: string; nickname?: string | null };

function agentLabel(a: Agent): string {
  return a.nickname?.trim() || a.username;
}

export function CustomerList({ scope }: { scope: 'mine' | 'public' }) {
  const qc = useQueryClient();
  const { permissions } = useSession();
  const canManage = permissions.includes('customers.manage') || permissions.includes('*');
  const canDelete = permissions.includes('customers.delete') || permissions.includes('*');
  const { openPerson, openIp } = useVisitorDrawer();
  const [importOpen, setImportOpen] = useState(false);

  // 在共享 config 基础上注入可点击「访客 ID」「最后访问 IP」两列（私海/公海共用），
  // 置于表首便于定位；访客 ID 列固定在左侧（横向溢出时保持可见）；点击分别打开全局访客 / IP 抽屉。
  const config = useMemo(() => {
    const columns = [...customersConfig.columns];
    const visitorColumn = {
      key: 'visitorId',
      header: '访客 ID',
      className: 'whitespace-nowrap',
      pinLeft: true,
      cell: (r: CustomerItem) => {
        const vid = r.visitorId;
        if (!vid) return <span className="text-muted-foreground">—</span>;
        return (
          <CopyableText
            value={vid}
            display={`#${vid.slice(0, 8)}`}
            // seed 透传客户档案联系信息：抽屉头部秒显，接口返回后由 identity 覆盖
            onActivate={() =>
              openPerson(vid, {
                name: r.name ?? null,
                company: r.company ?? null,
                email: r.email ?? null,
                phone: r.phone ?? null,
              })
            }
          />
        );
      },
    };
    const ipColumn = {
      key: 'lastIp',
      header: '最后访问 IP',
      // 富化字段排序：后端全量富化后内存排序（空值置后，IP 按段数值序）
      sortable: true,
      className: 'whitespace-nowrap',
      cell: (r: CustomerItem) => {
        const hash = r.lastIpHash;
        return (
          <CopyableText
            value={r.lastIp ?? null}
            onActivate={hash ? () => openIp(hash, { ipMasked: r.lastIpMasked ?? null }) : undefined}
          />
        );
      },
    };
    columns.unshift(visitorColumn, ipColumn);
    return { ...customersConfig, columns };
  }, [openPerson, openIp]);

  const agentsQ = useQuery<Agent[]>({
    queryKey: ['customers', 'agents'],
    queryFn: () => api.query<Agent[]>('/customers/agents'),
    enabled: scope === 'mine' && canManage,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['customers'] });
  }

  const claimMut = useMutation({
    mutationFn: (id: string) => api.post(`/customers/${id}/claim`, {}),
    onSuccess: () => {
      notifySuccess('已认领到我的私海');
      invalidate();
    },
    onError: (e) => notifyError(e, '认领失败'),
  });

  const releaseMut = useMutation({
    mutationFn: (id: string) => api.post(`/customers/${id}/release`, {}),
    onSuccess: () => {
      notifySuccess('已退回公海');
      invalidate();
    },
    onError: (e) => notifyError(e, '退回失败'),
  });

  const transferMut = useMutation({
    mutationFn: ({ id, toUserId }: { id: string; toUserId: string }) =>
      api.post(`/customers/${id}/transfer`, { toUserId }),
    onSuccess: () => {
      notifySuccess('已转移给其他坐席');
      invalidate();
    },
    onError: (e) => notifyError(e, '转移失败'),
  });

  const rowActions = (row: CustomerItem) => {
    if (!canManage) return null;

    if (scope === 'public') {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
              disabled={claimMut.isPending}
              onClick={() => claimMut.mutate(row.id)}
            >
              <Hand className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>认领到私海</TooltipContent>
        </Tooltip>
      );
    }

    // 我的客户：退回公海 + 转移
    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              disabled={releaseMut.isPending}
              onClick={() => releaseMut.mutate(row.id)}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>退回公海</TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={transferMut.isPending}
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-64 overflow-auto">
            <DropdownMenuLabel>转移给其他坐席</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(agentsQ.data ?? [])
              .filter((a) => a.id !== row.ownerId)
              .map((a) => (
                <DropdownMenuItem
                  key={a.id}
                  onClick={() => transferMut.mutate({ id: row.id, toUserId: a.id })}
                >
                  {agentLabel(a)}
                </DropdownMenuItem>
              ))}
            {agentsQ.isLoading ? <DropdownMenuItem disabled>加载中…</DropdownMenuItem> : null}
            {!agentsQ.isLoading && (agentsQ.data ?? []).length === 0 ? (
              <DropdownMenuItem disabled>暂无可转移坐席</DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  };

  return (
    <ResourceListView
      config={config}
      extraListParams={{ scope }}
      rowActions={rowActions}
      titleOverride={scope === 'mine' ? '我的客户' : '公海客户'}
      headerActions={
        canManage || canDelete ? (
          <>
            {canDelete && (
              <Button asChild variant="outline">
                <Link href="/customers/trash">
                  <Trash2 className="mr-2 h-4 w-4" />
                  回收站
                </Link>
              </Button>
            )}
            {canManage && (
              <>
                <Button variant="outline" onClick={() => setImportOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  导入 CSV
                </Button>
                <ImportCustomersDialog
                  scope={scope}
                  open={importOpen}
                  onOpenChange={setImportOpen}
                  onImported={invalidate}
                />
              </>
            )}
          </>
        ) : undefined
      }
    />
  );
}
