"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Eye,
  FileText,
  FolderInput,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Send,
  Share2,
  Tags,
  Trash2,
  Undo2,
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
import { useSession } from "@/components/session";
import { DocumentMoveDialog } from "@/components/documents/DocumentMoveDialog";
import { DocumentPromoteDialog } from "@/components/documents/DocumentPromoteDialog";
import { DocumentPublishDialog } from "@/components/documents/DocumentPublishDialog";
import { DocumentTagsManageDialog } from "@/components/documents/DocumentTagsManageDialog";
import { LastOperatorCell } from "@/components/LastOperatorCell";
import type { DocumentsResourceConfig } from "@/features/resources/documents";
import { buildDocListHref, canSeeDocDrafts, useDocTags, type DocListStatusFilter } from "@/features/documents";
import { StatusBadge, formatDateTime } from "@/features/constants";
import { useList, useRemove, useUpdate } from "@/features/hooks";
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

const STATUS_FILTER_OPTIONS: { label: string; value: DocListStatusFilter }[] = [
  { label: "已发布", value: "published" },
  { label: "草稿", value: "draft" },
  { label: "全部", value: "all" },
];

function parseStatusFilter(raw: string | null): DocListStatusFilter {
  if (raw === "draft") return "draft";
  if (raw === "all") return "all";
  return "published";
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
  onPublish,
  onMove,
  onPromoteToOrg,
  onDelete,
}: {
  doc: InternalDocumentItem;
  config: DocumentsResourceConfig;
  onPublish: () => void;
  onMove: () => void;
  onPromoteToOrg?: () => void;
  onDelete: () => void;
}) {
  const readHref = config.detailPath?.(doc) ?? `/documents/${doc.id}`;
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
            <DropdownMenuItem onClick={onMove}>
              <FolderInput className="mr-2 h-4 w-4" />
              移动到…
            </DropdownMenuItem>
          </Can>
          {config.promotable && onPromoteToOrg ? (
            <Can anyPerm={["docs.publish", "docs.manage"]}>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onPromoteToOrg}>
                <Share2 className="mr-2 h-4 w-4" />
                分享到公司知识库
              </DropdownMenuItem>
            </Can>
          ) : null}
          {config.publishable ? (
            <Can anyPerm={perms(config, "publish")}>
              <DropdownMenuItem onClick={onPublish}>
                {doc.status === "published" ? (
                  <>
                    <Undo2 className="mr-2 h-4 w-4" />
                    下线为草稿
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    发布供同事阅读
                  </>
                )}
              </DropdownMenuItem>
            </Can>
          ) : null}
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
  listStatus,
  onPublish,
  onMove,
  onPromoteToOrg,
  onDelete,
}: {
  doc: InternalDocumentItem;
  config: DocumentsResourceConfig;
  folderId?: string;
  activeTag?: string;
  listStatus?: DocListStatusFilter;
  onPublish: () => void;
  onMove: () => void;
  onPromoteToOrg?: () => void;
  onDelete: () => void;
}) {
  const readHref = config.detailPath?.(doc) ?? `/documents/${doc.id}`;
  const summary = doc.summary?.trim() || "暂无摘要";
  const pinned = doc.isPinned;
  const isDraft = doc.status === "draft";

  return (
    <ContentListItem
      href={readHref}
      linkLabel={doc.title}
      variant={pinned ? "pinned" : "default"}
      className={
        isDraft && !pinned
          ? "border-l-4 border-l-dashed border-l-muted-foreground/35 bg-muted/15"
          : undefined
      }
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
          <StatusBadge status={doc.status} />
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
                  status: listStatus,
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
          onPublish={onPublish}
          onMove={onMove}
          onPromoteToOrg={onPromoteToOrg}
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
  const sp = useSearchParams();
  const { permissions } = useSession();
  const showStatusFilter =
    config.folderScope === "shared" && canSeeDocDrafts(permissions);
  const statusFilter = showStatusFilter
    ? parseStatusFilter(sp.get("status"))
    : "published";

  function setStatusFilter(next: DocListStatusFilter) {
    const params = new URLSearchParams(sp.toString());
    if (next === "published") params.delete("status");
    else params.set("status", next);
    const q = params.toString();
    router.push(q ? `${config.basePath}?${q}` : config.basePath);
    setPage(1);
  }

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
  const [promoteTarget, setPromoteTarget] = useState<InternalDocumentItem | null>(
    null,
  );
  const [publishTarget, setPublishTarget] = useState<InternalDocumentItem | null>(
    null,
  );

  const sort = SORT_OPTIONS[sortIdx] ?? SORT_OPTIONS[0];
  const folderId = extraListParams?.folderId;
  const activeTag = extraListParams?.tag;

  const { data: tagStats, isLoading: tagsLoading } = useDocTags(
    config.folderScope,
  );

  const buildTagHref = (tag?: string) =>
    buildDocListHref(config.basePath, {
      folder: folderId,
      tag,
      status: showStatusFilter ? statusFilter : undefined,
    });

  const params = useMemo(
    () => ({
      page,
      limit: pageSize,
      search: search || undefined,
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder,
      ...(showStatusFilter && statusFilter !== "all"
        ? { status: statusFilter }
        : {}),
      ...extraListParams,
    }),
    [page, pageSize, search, sort, showStatusFilter, statusFilter, extraListParams],
  );

  const { data, isLoading, isError, error } = useList<InternalDocumentItem>(
    config.resource,
    params,
  );
  const updateMut = useUpdate<InternalDocumentItem>(config.resource);
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

  async function handleTogglePublish(doc: InternalDocumentItem) {
    if (doc.status === "published") {
      // 下线为草稿，直接执行
      try {
        await updateMut.mutateAsync({ id: doc.id, payload: { status: "draft" } });
        notifySuccess("已转为草稿，仅编辑者可见");
      } catch (e) {
        notifyError(e, "操作失败");
      }
    } else {
      // 发布供同事阅读，打开对话框选文件夹
      setPublishTarget(doc);
    }
  }

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
        folderScope={config.folderScope}
      />

      {config.promotable ? (
        <Alert icon="info" title="个人工作区，仅自己可见" className="mb-4 border-blue-200/80 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20">
          <p className="text-muted-foreground">
            整理完成后，在文档菜单中选择「分享到公司知识库」，即可移入内部文档供同事阅读。
          </p>
        </Alert>
      ) : null}

      <ListToolbar
        searchValue={searchInput}
        onSearchValueChange={setSearchInput}
        onSearchSubmit={() => {
          setPage(1);
          setSearch(searchInput.trim());
        }}
        searchPlaceholder="搜索标题或摘要…"
      >
        {showStatusFilter ? (
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as DocListStatusFilter)}
          >
            <SelectTrigger className="h-9 w-[108px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
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
              : statusFilter === "draft"
                ? "暂无草稿文档"
                : config.promotable
                ? "在此撰写个人草稿；完成后可通过「分享到公司知识库」让同事阅读"
                : "点击右上角新建，或从文件夹开始整理"
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
                  listStatus={showStatusFilter ? statusFilter : undefined}
                  onPublish={() => void handleTogglePublish(doc)}
                  onMove={() => setMoveTarget(doc)}
                  onPromoteToOrg={
                    config.promotable
                      ? () => setPromoteTarget(doc)
                      : undefined
                  }
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
                  listStatus={showStatusFilter ? statusFilter : undefined}
                  onPublish={() => void handleTogglePublish(doc)}
                  onMove={() => setMoveTarget(doc)}
                  onPromoteToOrg={
                    config.promotable
                      ? () => setPromoteTarget(doc)
                      : undefined
                  }
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
          folderScope={config.folderScope}
          open={moveTarget !== null}
          onOpenChange={(open) => !open && setMoveTarget(null)}
        />
      ) : null}

      {promoteTarget ? (
        <DocumentPromoteDialog
          documentId={promoteTarget.id}
          documentTitle={promoteTarget.title}
          open={promoteTarget !== null}
          onOpenChange={(open) => !open && setPromoteTarget(null)}
          onSuccess={() => {
            const id = promoteTarget.id;
            setPromoteTarget(null);
            router.push(`/documents/${id}`);
          }}
        />
      ) : null}

      {publishTarget ? (
        <DocumentPublishDialog
          documentId={publishTarget.id}
          documentTitle={publishTarget.title}
          currentFolderId={publishTarget.folderId ?? publishTarget.folder?.id}
          open={publishTarget !== null}
          onOpenChange={(open) => !open && setPublishTarget(null)}
        />
      ) : null}
    </TooltipProvider>
  );
}
