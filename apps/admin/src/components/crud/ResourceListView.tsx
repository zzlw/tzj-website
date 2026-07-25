'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  DataTable,
  type DataTableSort,
  Input,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TablePagination,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@tzj/ui';
import { Eye, Pencil, Plus, Search, Send, Trash2, Undo2, X } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Can } from '@/components/Can';
import { useList, useRemove, useUpdate } from '@/features/hooks';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { api } from '@/lib/apiClient';
import { WEB_BASE } from '@/lib/config';
import { notifyError, notifySuccess } from '@/lib/notify';
import {
  intField,
  sortField,
  stringField,
  type UrlFieldSpec,
  useUrlState,
} from '@/lib/use-url-state';
import type { ResourceConfig } from './config';

function perms<T>(config: ResourceConfig<T>, key: 'create' | 'edit' | 'publish') {
  const map = {
    create: ['content.create', 'content.edit'],
    edit: ['content.create', 'content.edit'],
    publish: ['content.create', 'content.edit'],
  } as const;
  return [...(config.permissions?.[key] ?? map[key])];
}

function deletePerm<T>(config: ResourceConfig<T>) {
  return config.permissions?.delete ?? 'content.delete';
}

/** 筛选芯片前缀：过滤器 label 形如「全部类型」，去掉「全部」前缀作为 chip 标签（如「类型」）。 */
function chipPrefix(label: string): string {
  return label.replace(/^全部/, '') || label;
}

interface ActiveChip {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
}

/** 汇总已应用的搜索 + 各筛选为「活动芯片」列表（含各自的移除回调），供工具栏渲染。 */
function buildActiveChips<T>(
  config: ResourceConfig<T>,
  urlState: Record<string, unknown>,
  setUrlState: (patch: Record<string, unknown>) => void,
  clearSearchInput: () => void,
): ActiveChip[] {
  const chips: ActiveChip[] = [];
  const appliedSearch = (urlState.search as string) || '';
  if (config.searchable && appliedSearch) {
    chips.push({
      key: '__search__',
      label: '搜索',
      value: appliedSearch,
      onRemove: () => {
        clearSearchInput();
        setUrlState({ search: '', page: 1 });
      },
    });
  }
  for (const flt of config.filters ?? []) {
    const v = (urlState[flt.key] as string) || '';
    if (!v) continue;
    const opt = flt.options.find((o) => o.value === v);
    chips.push({
      key: flt.key,
      label: chipPrefix(flt.label),
      value: opt?.label ?? v,
      onRemove: () => setUrlState({ [flt.key]: '', page: 1 }),
    });
  }
  return chips;
}

export function ResourceListView<T extends { id: string }>({
  config,
  defaultPageSize = 10,
  extraListParams,
  rowActions,
  titleOverride,
  headerActions,
}: {
  config: ResourceConfig<T>;
  /** 默认每页条数，用户可在分页器修改 */
  defaultPageSize?: number;
  /** 附加列表查询参数（如 folderId） */
  extraListParams?: Record<string, string | undefined>;
  /** 行级自定义操作（追加在默认操作之前、extraActions 之后），如认领/退回/转移 */
  rowActions?: (row: T) => ReactNode;
  /** 覆盖 PageHeader 标题（子页面复用同一 config 时区分，如「我的客户」/「公海客户」） */
  titleOverride?: string;
  /** PageHeader 右侧附加操作（渲染在「新增」按钮之前），如「导入 CSV」 */
  headerActions?: ReactNode;
}) {
  // 每个筛选器 key、page/pageSize/search/sort 都持久化到 URL query（默认值省略）。
  const specs = useMemo(() => {
    const s: Record<string, UrlFieldSpec<unknown>> = {
      page: intField(1, { min: 1 }) as UrlFieldSpec<unknown>,
      pageSize: intField(defaultPageSize, { min: 1 }) as UrlFieldSpec<unknown>,
      search: stringField() as UrlFieldSpec<unknown>,
      sort: sortField(config.defaultSort ?? null) as UrlFieldSpec<unknown>,
    };
    for (const flt of config.filters ?? []) {
      const values = flt.options.map((o) => o.value);
      s[flt.key] = {
        default: '',
        parse: (raw) => (raw && values.includes(raw) ? raw : ''),
        serialize: (v) => (v ? String(v) : null),
      };
    }
    return s;
  }, [config.filters, config.defaultSort, defaultPageSize]);

  const [urlState, setUrlState] = useUrlState(specs);
  const page = urlState.page as number;
  const pageSize = urlState.pageSize as number;
  const sort = urlState.sort as DataTableSort | null;
  const [searchInput, setSearchInput] = useState(() => (urlState.search as string) || '');
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);

  // 击键防抖：停止输入 300ms 后才把检索词落地到 URL 并回到第 1 页（复用访客中心的 useDebouncedValue，
  // 避免每次击键都请求后端）。初次挂载 debouncedSearch 恒等于已应用值，故跳过写入、不误重置分页。
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300);
  const appliedSearch = (urlState.search as string) || '';
  useEffect(() => {
    if (debouncedSearch !== appliedSearch) setUrlState({ search: debouncedSearch, page: 1 });
  }, [debouncedSearch, appliedSearch, setUrlState]);

  const params = useMemo(() => {
    const flt: Record<string, string> = {};
    for (const f of config.filters ?? []) {
      const v = urlState[f.key] as string | undefined;
      if (v) flt[f.key] = v;
    }
    return {
      page,
      limit: pageSize,
      search: (urlState.search as string) || undefined,
      sortBy: sort?.column,
      sortOrder: sort?.order,
      ...extraListParams,
      ...flt,
    };
  }, [urlState, page, pageSize, sort, config.filters, extraListParams]);

  const { data, isLoading, isError, error } = useList<T>(config.resource, params);
  const updateMut = useUpdate<T>(config.resource);
  const removeMut = useRemove(config.resource);

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  async function handleTogglePublish(row: T) {
    const cur = (row as { status?: string }).status;
    const next = cur === 'published' ? 'draft' : 'published';
    try {
      await updateMut.mutateAsync({ id: row.id, payload: { status: next } });
      notifySuccess(next === 'published' ? '已发布' : '已转为草稿');
    } catch (e) {
      notifyError(e, '操作失败');
    }
  }

  /** 预览：已发布内容直接打开前台页；草稿/归档先向 API 换取 30 分钟预览令牌（CMS 惯例，链接可分享给评审）。 */
  async function handlePreview(row: T) {
    if (!config.previewPath) return;
    const url = `${WEB_BASE}${config.previewPath(row)}`;
    const { status, slug } = row as { status?: string; slug?: string };
    if (!status || status === 'published' || !slug) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    // 先同步开窗规避浏览器弹窗拦截，拿到令牌后再导航
    const win = window.open('about:blank', '_blank');
    try {
      const { token } = await api.post<{ token: string }>('/preview-tokens', {
        resource: config.resource,
        slug,
      });
      const previewUrl = `${url}?previewToken=${encodeURIComponent(token)}`;
      if (win) {
        win.opener = null;
        win.location.replace(previewUrl);
      } else {
        window.open(previewUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      win?.close();
      notifyError(e, '生成预览链接失败');
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await removeMut.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      notifySuccess(`${config.singular}已删除`);
    } catch (e) {
      notifyError(e, '删除失败');
    }
  }

  // 已应用的搜索/筛选摘要：驱动「活动筛选芯片 + 命中计数 + 一键清除」（业内分面检索惯例）。
  const activeChips = buildActiveChips(config, urlState, setUrlState, () => setSearchInput(''));

  const clearAllFilters = () => {
    setSearchInput('');
    const reset: Record<string, unknown> = { search: '', page: 1 };
    for (const flt of config.filters ?? []) reset[flt.key] = '';
    setUrlState(reset);
  };

  return (
    <TooltipProvider>
      <PageHeader
        title={titleOverride ?? config.title}
        action={
          <div className="flex items-center gap-2">
            {headerActions}
            <Can anyPerm={perms(config, 'create')}>
              <Button asChild>
                <Link href={`${config.basePath}/new`}>
                  <Plus className="mr-2 h-4 w-4" />
                  新增{config.singular}
                </Link>
              </Button>
            </Can>
          </div>
        }
      />

      {(config.searchable || config.filters?.length) && (
        <Card className="mb-6 border-border/80 py-0 shadow-sm">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap gap-3">
              {config.searchable && (
                <form
                  className="relative min-w-[220px] flex-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setUrlState({ search: searchInput.trim(), page: 1 });
                  }}
                >
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder={config.searchPlaceholder ?? '搜索标题…'}
                    className="pl-9 pr-9"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInput('');
                        setUrlState({ search: '', page: 1 });
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="清除搜索"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </form>
              )}
              {config.filters?.map((flt) => (
                <Select
                  key={flt.key}
                  value={(urlState[flt.key] as string) || '__all__'}
                  onValueChange={(v) => {
                    setUrlState({ [flt.key]: v && v !== '__all__' ? v : '', page: 1 });
                  }}
                >
                  <SelectTrigger className="h-9 w-[160px]">
                    <SelectValue placeholder={flt.label} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{flt.label}</SelectItem>
                    {flt.options.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ))}
            </div>

            {activeChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {pagination && (
                  <span className="mr-1 text-xs text-muted-foreground">
                    找到{' '}
                    <span className="font-medium text-foreground tabular-nums">
                      {pagination.total.toLocaleString('zh-CN')}
                    </span>{' '}
                    条结果
                  </span>
                )}
                {activeChips.map((chip) => (
                  <Badge
                    key={chip.key}
                    variant="outline"
                    className="gap-1 border-border bg-muted/60 font-normal text-muted-foreground"
                  >
                    <span className="text-foreground/60">{chip.label}：</span>
                    {chip.value}
                    <button
                      type="button"
                      aria-label={`移除${chip.label}筛选`}
                      onClick={chip.onRemove}
                      className="hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                  清除全部
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isError && (
        <Alert variant="destructive" icon="error" className="mb-4">
          加载失败：{error instanceof Error ? error.message : '未知错误'}
        </Alert>
      )}

      <DataTable
        columns={config.columns}
        rows={rows}
        loading={isLoading}
        sort={sort}
        defaultSort={config.defaultSort}
        pinActions={config.pinActions}
        onSortChange={(next) => {
          setUrlState({ sort: next, page: 1 });
        }}
        renderActions={(row) => (
          <div className="flex items-center justify-end gap-1">
            {config.extraActions?.(row)}
            {rowActions?.(row)}
            {config.detailPath && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                    <Link href={config.detailPath(row)}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>阅读</TooltipContent>
              </Tooltip>
            )}
            {config.previewPath && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handlePreview(row)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {(row as { status?: string }).status === 'published' ? '预览' : '草稿预览'}
                </TooltipContent>
              </Tooltip>
            )}
            {config.publishable && (
              <Can anyPerm={perms(config, 'publish')}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleTogglePublish(row)}
                    >
                      {(row as { status?: string }).status === 'published' ? (
                        <Undo2 className="h-4 w-4" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {(row as { status?: string }).status === 'published'
                      ? '下线为草稿'
                      : '立即发布'}
                  </TooltipContent>
                </Tooltip>
              </Can>
            )}
            <Can anyPerm={perms(config, 'edit')}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                    <Link href={`${config.basePath}/${row.id}/edit`}>
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>编辑</TooltipContent>
              </Tooltip>
            </Can>
            <Can perm={deletePerm(config)}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(row)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>删除</TooltipContent>
              </Tooltip>
            </Can>
          </div>
        )}
      />

      {pagination && (
        <TablePagination
          page={page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          pageSize={pageSize}
          onPageChange={(p) => setUrlState({ page: p })}
          onPageSizeChange={(size) => {
            setUrlState({ pageSize: size, page: 1 });
          }}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`删除${config.singular}`}
        description={`确认删除该${config.singular}？此操作不可撤销。`}
        confirmLabel="删除"
        onConfirm={handleDeleteConfirm}
        loading={removeMut.isPending}
      />
    </TooltipProvider>
  );
}
