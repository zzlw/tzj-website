"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
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
} from "@tzj/ui";
import { Can } from "@/components/Can";
import { DocumentMoveDialog } from "@/components/documents/DocumentMoveDialog";
import { DocumentTagsManageDialog } from "@/components/documents/DocumentTagsManageDialog";
import { LastOperatorCell } from "@/components/LastOperatorCell";
import type { DocumentsResourceConfig } from "@/features/resources/documents";
import { buildDocListHref, useDocTags } from "@/features/documents";
import { formatDateTime } from "@/features/constants";
import { useList, useRemove } from "@/features/hooks";
import type { InternalDocumentItem } from "@/features/types";
import { notifyError, notifySuccess } from "@/lib/notify";

const SORT_OPTIONS = [
  { label: "最近更新", sortBy: "updatedAt", sortOrder: "desc" },
  { label: "最近发布", sortBy: "publishedAt", sortOrder: "desc" },
  { label: "标题 A–Z", sortBy: "title", sortOrder: "asc" },
  { label: "阅读最多", sortBy: "viewCount", sortOrder: "desc" },
] as const;

function sortKey(sortBy: string, sortOrder: string) {
  return `${sortBy}:${sortOrder}`;
}

function perms(config: DocumentsResourceConfig, key: "create" | "edit" | "publish") {
  const map = {
    create: ["docs.create"],
    edit: ["docs.edit"],
    publish: ["docs.publish"],
  } as const;
  return [...(config.permissions?.[key] ?? map[key])];
}

function deletePerm(config: DocumentsResourceConfig) {
  return config.permissions?.delete ?? "docs.delete";
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

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href={readHref}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>阅读</TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">更多操作</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <Can anyPerm={perms(config, "edit")}>
            <DropdownMenuItem asChild>
              <Link href={editHref}>
                <Pencil className="mr-2 h-4 w-4" />
                编辑
              </Link>
            </DropdownMenuItem>
          </Can>
          <Can anyPerm={perms(config, "edit")}>
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
  onMove,
  onDelete,
}: {
  doc: InternalDocumentItem;
  config: DocumentsResourceConfig;
  folderId?: string;
  activeTag?: string;
  onMove: () => void;
  onDelete: () => void;
}) {
  const readHref = config.detailPath?.(doc) ?? `/documents/mine/${doc.id}`;
  const summary = doc.summary?.trim() || "暂无摘要";
  const pinned = doc.isPinned;

  return (
    <ContentListItem
      href={readHref}
      linkLabel={doc.title}
      variant={pinned ? "pinned" : "default"}
      icon={
        pinned ? (
          <Pin className="h-5 w-5 fill-current" />
        ) : (
          <FileText className="h-5 w-5" />
        )
      }
      title={doc.title}
      description={summary}
      badges={
        <>
          {pinned ? <PinnedBadge /> : null}
        </>
      }
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
          {doc.status === "published" && doc.publishedAt ? (
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
                <LastOperatorCell
                  user={doc.lastOperatorUser}
                  fallback={doc.lastOperator}
                />
              </span>
            </>
          )}
        </>
      }
      actions={
        <DocumentRowActions
          doc={doc}
          config={config}
          onMove={onMove}
          onDelete={onDelete}
        />
      }
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

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortIdx, setSortIdx] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<InternalDocumentItem | null>(
    null,
  );
  const [tagsManageOpen, setTagsManageOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<InternalDocumentItem | null>(
    null,
  );
  const sort = SORT_OPTIONS[sortIdx] ?? SORT_OPTIONS[0];
  const folderId = extraListParams?.folderId;
  const activeTag = extraListParams?.tag;

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
      notifyError(e, "删除失败");
    }
  }

  return (
    <TooltipProvider>
      <PageHeader
        title={config.title}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Can anyPerm={["docs.create", "docs.manage"]}>
              <Button
                variant="outline"
                onClick={() => setTagsManageOpen(true)}
              >
                <Tags className="mr-2 h-4 w-4" />
                标签管理
              </Button>
            </Can>
            <Can anyPerm={perms(config, "create")}>
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

      <DocumentTagsManageDialog
        open={tagsManageOpen}
        onOpenChange={setTagsManageOpen}
      />

      <ListToolbar
        searchValue={searchInput}
        onSearchValueChange={setSearchInput}
        onSearchSubmit={() => {
          setPage(1);
          setSearch(searchInput.trim());
        }}
        searchPlaceholder="搜索标题或摘要…"
      >
        <Select
          value={String(sortIdx)}
          onValueChange={(v) => {
            setSortIdx(Number(v));
            setPage(1);
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
        <Can anyPerm={["docs.create", "docs.manage"]}>
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
          加载失败：{error instanceof Error ? error.message : "未知错误"}
        </Alert>
      ) : null}

      {isLoading ? (
        <ContentListSkeleton count={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="暂无文档"
          description={
            search
              ? "没有匹配的文档，试试其他关键词"
              : "点击上方「新增文档」开始创建"
          }
          action={
            <Can anyPerm={perms(config, "create")}>
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
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
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
