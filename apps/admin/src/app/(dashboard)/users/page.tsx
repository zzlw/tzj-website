'use client';

import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  Input,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TablePagination,
  TooltipProvider,
} from '@tzj/ui';
import { LockOpen, Plus, Search, Trash2, UserCog } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Can } from '@/components/Can';
import { useSession } from '@/components/session';
import { TwoFactorPolicyCard } from '@/components/users/TwoFactorPolicyCard';
import { type RoleOption, useRoleOptions } from '@/features/access';
import { formatDate } from '@/features/constants';
import { useList, useRemove, useUpdate } from '@/features/hooks';
import type { UserItem } from '@/features/types';
import { roleLabel } from '@/features/users';
import { notifyError, notifySuccess } from '@/lib/notify';
import { intField, stringField, useUrlState } from '@/lib/use-url-state';

// 锁定中：lockedUntil 存在且尚未到期（到期后后端允许登录，列表不再标记）
function isLocked(r: UserItem): boolean {
  return Boolean(r.lockedUntil && new Date(r.lockedUntil) > new Date());
}

const COLUMNS = (roleOptions: RoleOption[]): DataTableColumn<UserItem>[] => [
  {
    key: 'username',
    header: '用户名',
    className: 'font-medium',
    // 主标识列固定到左侧，横向滚动时保持账号可辨认（滚动阴影按需出现）。
    pinLeft: true,
    cell: (r) => (
      <div>
        <p>{r.username}</p>
        {r.nickname ? <p className="text-xs text-muted-foreground">{r.nickname}</p> : null}
      </div>
    ),
  },
  {
    key: 'role',
    header: '角色',
    cell: (r) => <Badge variant="outline">{roleLabel(r.role, roleOptions)}</Badge>,
  },
  {
    key: 'email',
    header: '邮箱',
    className: 'text-muted-foreground',
    cell: (r) => r.email ?? '—',
  },
  {
    key: 'isActive',
    header: '状态',
    cell: (r) => (
      <div className="flex items-center gap-1.5">
        {r.isActive ? (
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
            启用
          </Badge>
        ) : (
          <Badge variant="outline" className="border-zinc-200 bg-zinc-50 text-zinc-600">
            停用
          </Badge>
        )}
        {isLocked(r) && (
          <Badge
            variant="outline"
            className="border-amber-200 bg-amber-50 text-amber-700"
            title={`锁定至 ${formatDate(r.lockedUntil as string)}`}
          >
            已锁定
          </Badge>
        )}
      </div>
    ),
  },
  {
    key: 'twoFactorEnabled',
    header: '两步验证',
    cell: (r) =>
      r.twoFactorEnabled ? (
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
          已启用
        </Badge>
      ) : (
        <Badge variant="outline" className="border-zinc-200 bg-zinc-50 text-zinc-600">
          未启用
        </Badge>
      ),
  },
  {
    key: 'lastLoginAt',
    header: '最近登录',
    className: 'whitespace-nowrap text-muted-foreground',
    cell: (r) => (r.lastLoginAt ? formatDate(r.lastLoginAt) : '—'),
  },
];

export default function UsersPage() {
  const { username: currentUsername } = useSession();
  const [urlState, setUrlState] = useUrlState({
    page: intField(1, { min: 1 }),
    pageSize: intField(20, { min: 1 }),
    search: stringField(),
    role: stringField(),
  });
  const { page, pageSize, role: roleFilter } = urlState;
  const [searchInput, setSearchInput] = useState(() => urlState.search || '');
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);

  const params = useMemo(
    () => ({
      page,
      limit: pageSize,
      search: urlState.search || undefined,
      role: roleFilter || undefined,
    }),
    [page, pageSize, urlState.search, roleFilter],
  );

  const { data, isLoading, isError, error } = useList<UserItem>('users', params);
  const removeMut = useRemove('users');
  const updateMut = useUpdate<UserItem>('users');
  const { data: roleOptions = [] } = useRoleOptions();

  const columns = useMemo(() => COLUMNS(roleOptions), [roleOptions]);

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  async function handleUnlock(r: UserItem) {
    try {
      // 复用编辑接口：lockedUntil 传 null 即解锁
      await updateMut.mutateAsync({ id: r.id, payload: { lockedUntil: null } });
      notifySuccess(`账号「${r.username}」已解锁`);
    } catch (e) {
      notifyError(e, '解锁失败');
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await removeMut.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      notifySuccess('账号已删除');
    } catch (e) {
      notifyError(e, '删除失败');
    }
  }

  return (
    <TooltipProvider>
      <PageHeader
        title="账号管理"
        description="管理系统登录账号与角色分配"
        action={
          <Button asChild>
            <Link href="/users/new">
              <Plus className="mr-2 h-4 w-4" />
              新建账号
            </Link>
          </Button>
        }
      />

      <Can allow={['admin']}>
        <TwoFactorPolicyCard />
      </Can>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form
          className="flex min-w-[200px] flex-1 items-center gap-2 sm:max-w-sm"
          onSubmit={(e) => {
            e.preventDefault();
            setUrlState({ search: searchInput.trim(), page: 1 });
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="搜索用户名、昵称、邮箱…"
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">
            搜索
          </Button>
        </form>
        <Select
          value={roleFilter || 'all'}
          onValueChange={(v) => {
            setUrlState({ role: v === 'all' ? '' : v, page: 1 });
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="全部角色" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部角色</SelectItem>
            {roleOptions.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError && (
        <Alert variant="destructive" icon="error" className="mb-4">
          加载失败：{error instanceof Error ? error.message : '未知错误'}
        </Alert>
      )}

      <DataTable<UserItem>
        columns={columns}
        rows={rows}
        loading={isLoading}
        emptyText="暂无账号"
        pinActions
        renderActions={(r) => (
          <div className="flex justify-end gap-1">
            {isLocked(r) && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-amber-600 hover:text-amber-700"
                onClick={() => void handleUnlock(r)}
                disabled={updateMut.isPending}
                aria-label="解锁"
                title="解锁"
              >
                <LockOpen className="h-4 w-4" />
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
              <Link href={`/users/${r.id}/edit`} aria-label="编辑">
                <UserCog className="h-4 w-4" />
              </Link>
            </Button>
            {r.username !== currentUsername && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setDeleteTarget(r)}
                aria-label="删除"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      />

      {pagination && (
        <TablePagination
          className="mt-6"
          page={page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          pageSize={pageSize}
          onPageChange={(p) => setUrlState({ page: p })}
          onPageSizeChange={(size) => {
            setUrlState({ pageSize: size, page: 1 });
          }}
          unit="个"
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="删除账号"
        description={
          deleteTarget
            ? `确认删除账号「${deleteTarget.username}」？此操作不可撤销，该用户所有会话将立即失效。`
            : undefined
        }
        confirmLabel="删除"
        onConfirm={handleDeleteConfirm}
        loading={removeMut.isPending}
      />
    </TooltipProvider>
  );
}
