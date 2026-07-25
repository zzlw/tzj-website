'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  ContentList,
  ContentListItem,
  ContentListSectionHeader,
  ContentListSkeleton,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  ListToolbar,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TablePagination,
  TagChip,
  TagFilterBar,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@tzj/ui';
import {
  Eye,
  FileText,
  FolderInput,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Tags,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Can } from '@/components/Can';
import { DocumentPermissionDialog } from '@/components/DocumentPermissionDialog';
import { DocumentMoveDialog } from '@/components/documents/DocumentMoveDialog';
import { DocumentTagsManageDialog } from '@/components/documents/DocumentTagsManageDialog';
import { LastOperatorCell } from '@/components/LastOperatorCell';
import { formatDateTime } from '@/features/constants';
import { buildDocListHref, useDocTags } from '@/features/documents';
import { useList, useRemove } from '@/features/hooks';
import type { DocumentsResourceConfig } from '@/features/resources/documents';
import type { InternalDocumentItem } from '@/features/types';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { highlightKeyword } from '@/lib/highlight';
import { notifyError, notifySuccess } from '@/lib/notify';
import { intField, stringField, useUrlState } from '@/lib/use-url-state';

const SORT_OPTIONS = [
  { label: '最近更新', sortBy: 'updatedAt', sortOrder: 'desc' },
  { label: '最近发布', sortBy: 'publishedAt', sortOrder: 'desc' },
  { label: '标题 A–Z', sortBy: 'title', sortOrder: 'asc' },
  { label: '阅读最多', sortBy: 'viewCount', sortOrder: 'desc' },
] as const;

function sortKey(sortBy: string, sortOrder: string) {
  return `${sortBy}:${sortOrder}`;
}

function perms(config: DocumentsResourceConfig, key: 'create' | 'edit' | 'publish') {
  const map = {
    create: ['docs.create'],
    edit: ['docs.edit'],
    publish: ['docs.publish'],
  } as const;
  return [...(config.permissions?.[key] ?? map[key])];
}

function deletePerm(config: DocumentsResourceConfig) {
  return config.permissions?.delete ?? 'docs.delete';
}

function MetaDot() {
  return (
    <span className="text-border" aria-hidden>
      ·
    </span>
  );
}

function DocumentRowActions({
  doc,
  config,
  onMove,
  onDelete,
}: {
  doc: InternalDocumentItem;
  config: DocumentsResourceConfig;
  onMove: () => void;
  onDelete: () => void;
}) {
  const readHref = config.detailPath?.(doc) ?? `/documents/mine/${doc.id}`;
  const editHref = `${config.basePath}/${doc.id}/edit`;
  const [permOpen, setPermOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">更多操作</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <Can anyPerm={perms(config, 'edit')}>
            <DropdownMenuItem asChild>
              <Link href={editHref}>
                <Pencil className="mr-2 h-4 w-4" />
                编辑
              </Link>
            </DropdownMenuItem>
          </Can>
          <Can anyPerm={perms(config, 'edit')}>
            <DropdownMenuItem onClick={() => setPermOpen(true)}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2 h-4 w-4"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              权限管理
            </DropdownMenuItem>
          </Can>
          <Can anyPerm={perms(config, 'edit')}>
            <DropdownMenuItem onClick={onMove}>
              <FolderInput className="mr-2 h-4 w-4" />
              移动到…
            </DropdownMenuItem>
          </Can>
          <Can perm={deletePerm(config)}>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除
            </DropdownMenuItem>
          </Can>
        </DropdownMenuContent>
      </DropdownMenu>

      <DocumentPermissionDialog
        documentId={doc.id}
        documentTitle={doc.title}
        open={permOpen}
        onOpenChange={setPermOpen}
      />
    </>
  );
}

function PinnedBadge() {
  return (
    <Badge className="gap-1 border-transparent bg-amber-500 text-white shadow-sm hover:bg-amber-500">
      <Pin className="h-3 w-3 fill-current" />
      置顶
    </Badge>
  );
}

function DocumentListRow({
  doc,
  config,
  folderId,
  activeTag,
  search,
  onMove,
  onDelete,
}: {
  doc: InternalDocumentItem;
  config: DocumentsResourceConfig;
  folderId?: string;
  activeTag?: string;
  /** 已应用的检索词：命中时高亮标题/摘要（业内检索惯例） */
  search?: string;
  onMove: () => void;
  onDelete: () => void;
}) {
  const readHref = config.detailPath?.(doc) ?? `/documents/mine/${doc.id}`;
  const summary = doc.summary?.trim() || '暂无摘要';
  const pinned = doc.isPinned;

  return (
    <ContentListItem
      href={readHref}
      linkLabel={doc.title}
      variant={pinned ? 'pinned' : 'default'}
      icon={pinned ? <Pin className="h-5 w-5 fill-current" /> : <FileText className="h-5 w-5" />}
      title={highlightKeyword(doc.title, search)}
      description={highlightKeyword(summary, search)}
      badges={<>{pinned ? <PinnedBadge /> : null}</>}
      tags={
        doc.tags?.length
          ? doc.tags.map((tag) => (
              <TagChip
                key={tag}
                label={tag}
                active={activeTag === tag}
                href={buildDocListHref(config.basePath, {
                  folder: folderId,
                  tag,
                })}
                onClick={(e) => e.stopPropagation()}
              />
            ))
          : undefined
      }
      meta={
        <>
          {doc.folder ? (
            <span className="inline-flex items-center gap-1">
              <FolderOpen className="h-3 w-3 opacity-70" />
              {doc.folder.name}
            </span>
          ) : (
            <span>未分类</span>
          )}
          <MetaDot />
          <span>更新 {formatDateTime(doc.updatedAt)}</span>
          {doc.status === 'published' && doc.publishedAt ? (
            <>
              <MetaDot />
              <span>发布 {formatDateTime(doc.publishedAt)}</span>
            </>
          ) : null}
          <MetaDot />
          <span>{doc.viewCount} 次阅读</span>
          {(doc.lastOperatorUser || doc.lastOperator) && (
            <>
              <MetaDot />
              <span className="inline-flex items-center gap-1">
                <LastOperatorCell user={doc.lastOperatorUser} fallback={doc.lastOperator} />
              </span>
            </>
          )}
          {/* 可见范围 */}
          <MetaDot />
          <span className="inline-flex items-center gap-1">
            {doc.visibility === 'public' && (
              <Badge
                variant="outline"
                className="h-5 px-1.5 text-[10px] border-green-600 text-green-700 dark:border-green-500 dark:text-green-400"
              >
                全局可见
              </Badge>
            )}
            {doc.visibility === 'partial' && (
              <Badge
                variant="outline"
                className="h-5 px-1.5 text-[10px] border-blue-600 text-blue-700 dark:border-blue-500 dark:text-blue-400"
              >
                部分人可见
              </Badge>
            )}
            {doc.visibility === 'private' && (
              <Badge
                variant="outline"
                className="h-5 px-1.5 text-[10px] border-gray-600 text-gray-700 dark:border-gray-500 dark:text-gray-400"
              >
                仅自己可见
              </Badge>
            )}
          </span>
        </>
      }
      actions={<DocumentRowActions doc={doc} config={config} onMove={onMove} onDelete={onDelete} />}
    />
  );
}

export function DocumentListView({
  config,
  extraListParams,
  defaultPageSize = 20,
}: {
  config: DocumentsResourceConfig;
  extraListParams?: Record<string, string | undefined>;
  defaultPageSize?: number;
}) {
  const router = useRouter();

  const [urlState, setUrlState] = useUrlState({
    page: intField(1, { min: 1 }),
    pageSize: intField(defaultPageSize, { min: 1 }),
    search: stringField(),
    sortIdx: intField(0, { min: 0 }),
  });
  const { page, pageSize, sortIdx } = urlState;
  const search = urlState.search;
  const [searchInput, setSearchInput] = useState(() => urlState.search || '');
  const [deleteTarget, setDeleteTarget] = useState<InternalDocumentItem | null>(null);
  const [tagsManageOpen, setTagsManageOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<InternalDocumentItem | null>(null);
  const sort = SORT_OPTIONS[sortIdx] ?? SORT_OPTIONS[0];
  const folderId = extraListParams?.folderId;
  const activeTag = extraListParams?.tag;

  // 击键防抖：停止输入 300ms 后才把检索词落地到 URL 并回到第 1 页（对齐 ResourceListView，
  // 避免逐键请求后端）。初次挂载 debouncedSearch 恒等于已应用值，故跳过写入、不误重置分页。
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300);
  const appliedSearch = urlState.search || '';
  useEffect(() => {
    if (debouncedSearch !== appliedSearch) setUrlState({ search: debouncedSearch, page: 1 });
  }, [debouncedSearch, appliedSearch, setUrlState]);

  const { data: tagStats, isLoading: tagsLoading } = useDocTags();

  const buildTagHref = (tag?: string) =>
    buildDocListHref(config.basePath, {
      folder: folderId,
      tag,
    });

  const params = useMemo(
    () => ({
      page,
      limit: pageSize,
      search: search || undefined,
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder,
      ...extraListParams,
    }),
    [page, pageSize, search, sort, extraListParams],
  );

  const { data, isLoading, isError, error } = useList<InternalDocumentItem>(
    config.resource,
    params,
  );
  const removeMut = useRemove(config.resource);

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  // 已应用的搜索/标签摘要：驱动「活动筛选芯片 + 命中计数 + 一键清除」（对齐分面检索惯例）。
  const activeChips: { key: string; label: string; value: string; onRemove: () => void }[] = [];
  if (search) {
    activeChips.push({
      key: 'search',
      label: '搜索',
      value: search,
      onRemove: () => {
        setSearchInput('');
        setUrlState({ search: '', page: 1 });
      },
    });
  }
  if (activeTag) {
    activeChips.push({
      key: 'tag',
      label: '标签',
      value: activeTag,
      onRemove: () => router.push(buildDocListHref(config.basePath, { folder: folderId })),
    });
  }

  // 一键清除：重置搜索并回到 basePath（同时清掉 folder/tag 查询）。
  const clearAllFilters = () => {
    setSearchInput('');
    router.push(config.basePath);
  };

  const { pinnedRows, restRows } = useMemo(() => {
    const pinned: InternalDocumentItem[] = [];
    const rest: InternalDocumentItem[] = [];
    for (const row of rows) {
      if (row.isPinned) pinned.push(row);
      else rest.push(row);
    }
    return { pinnedRows: pinned, restRows: rest };
  }, [rows]);

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

  return (
    <TooltipProvider>
      <PageHeader
        title={config.title}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Can anyPerm={['docs.create', 'docs.manage']}>
              <Button variant="outline" onClick={() => setTagsManageOpen(true)}>
                <Tags className="mr-2 h-4 w-4" />
                标签管理
              </Button>
            </Can>
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

      <DocumentTagsManageDialog open={tagsManageOpen} onOpenChange={setTagsManageOpen} />

      <ListToolbar
        searchValue={searchInput}
        onSearchValueChange={setSearchInput}
        onSearchSubmit={() => {
          setUrlState({ search: searchInput.trim(), page: 1 });
        }}
        searchPlaceholder="搜索标题、摘要、正文、标签或文件夹…"
      >
        <Select
          value={String(sortIdx)}
          onValueChange={(v) => {
            setUrlState({ sortIdx: Number(v), page: 1 });
          }}
        >
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt, i) => (
              <SelectItem key={sortKey(opt.sortBy, opt.sortOrder)} value={String(i)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ListToolbar>

      {activeChips.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {pagination ? (
            <span className="mr-1 text-xs text-muted-foreground">
              找到{' '}
              <span className="font-medium text-foreground tabular-nums">
                {pagination.total.toLocaleString('zh-CN')}
              </span>{' '}
              条结果
            </span>
          ) : null}
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
      ) : null}

      {tagStats?.length || activeTag ? (
        <Card className="mb-4 border-border/80 py-0 shadow-sm">
          <CardContent className="p-4">
            <TagFilterBar
              tags={tagStats ?? []}
              activeTag={activeTag}
              loading={tagsLoading}
              buildTagHref={buildTagHref}
              onTagChange={(tag) => router.push(buildTagHref(tag))}
              onManageTags={() => setTagsManageOpen(true)}
            />
          </CardContent>
        </Card>
      ) : (
        <Can anyPerm={['docs.create', 'docs.manage']}>
          <div className="mb-4 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground"
              onClick={() => setTagsManageOpen(true)}
            >
              <Tags className="mr-1.5 h-3.5 w-3.5" />
              标签管理
            </Button>
          </div>
        </Can>
      )}

      {isError ? (
        <Alert variant="destructive" icon="error" className="mb-4">
          加载失败：{error instanceof Error ? error.message : '未知错误'}
        </Alert>
      ) : null}

      {isLoading ? (
        <ContentListSkeleton count={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="暂无文档"
          description={search ? '没有匹配的文档，试试其他关键词' : '点击上方「新增文档」开始创建'}
          action={
            <Can anyPerm={perms(config, 'create')}>
              <Button variant="outline" size="sm" asChild>
                <Link href={`${config.basePath}/new`}>
                  <Plus className="mr-2 h-4 w-4" />
                  新建{config.singular}
                </Link>
              </Button>
            </Can>
          }
        />
      ) : (
        <ContentList>
          {pinnedRows.length > 0 ? (
            <>
              <ContentListSectionHeader
                title="置顶"
                icon={<Pin className="h-3.5 w-3.5 fill-current text-amber-600" />}
                className="bg-amber-50/80 dark:bg-amber-950/30"
              />
              {pinnedRows.map((doc) => (
                <DocumentListRow
                  key={doc.id}
                  doc={doc}
                  config={config}
                  folderId={folderId}
                  activeTag={activeTag}
                  search={search}
                  onMove={() => setMoveTarget(doc)}
                  onDelete={() => setDeleteTarget(doc)}
                />
              ))}
            </>
          ) : null}
          {restRows.length > 0
            ? restRows.map((doc) => (
                <DocumentListRow
                  key={doc.id}
                  doc={doc}
                  config={config}
                  folderId={folderId}
                  activeTag={activeTag}
                  search={search}
                  onMove={() => setMoveTarget(doc)}
                  onDelete={() => setDeleteTarget(doc)}
                />
              ))
            : null}
        </ContentList>
      )}

      {pagination && pagination.total > 0 ? (
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
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`删除${config.singular}`}
        description={`确认删除「${deleteTarget?.title}」？此操作不可撤销。`}
        confirmLabel="删除"
        onConfirm={handleDeleteConfirm}
        loading={removeMut.isPending}
      />

      {moveTarget ? (
        <DocumentMoveDialog
          documentId={moveTarget.id}
          documentTitle={moveTarget.title}
          currentFolderId={moveTarget.folderId ?? moveTarget.folder?.id}
          open={moveTarget !== null}
          onOpenChange={(open) => !open && setMoveTarget(null)}
        />
      ) : null}
    </TooltipProvider>
  );
}
