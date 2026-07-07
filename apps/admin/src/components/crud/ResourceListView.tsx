"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Pencil, Plus, Search, Send, Trash2, Undo2 } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  DataTable,
  Input,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  TablePagination,
  type DataTableSort,
} from "@tzj/ui";
import { Can } from "@/components/Can";
import { WEB_BASE } from "@/lib/config";
import { useList, useUpdate, useRemove } from "@/features/hooks";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { ResourceConfig } from "./config";

function perms<T>(config: ResourceConfig<T>, key: "create" | "edit" | "publish") {
  const map = {
    create: ["content.create", "content.edit"],
    edit: ["content.create", "content.edit"],
    publish: ["content.create", "content.edit"],
  } as const;
  return [...(config.permissions?.[key] ?? map[key])];
}

function deletePerm<T>(config: ResourceConfig<T>) {
  return config.permissions?.delete ?? "content.delete";
}

export function ResourceListView<T extends { id: string }>({
  config,
  defaultPageSize = 10,
  extraListParams,
}: {
  config: ResourceConfig<T>;
  /** 默认每页条数，用户可在分页器修改 */
  defaultPageSize?: number;
  /** 附加列表查询参数（如 folderId） */
  extraListParams?: Record<string, string | undefined>;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<DataTableSort | null>(
    config.defaultSort ?? null,
  );
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);

  const params = useMemo(
    () => ({
      page,
      limit: pageSize,
      search: search || undefined,
      sortBy: sort?.column,
      sortOrder: sort?.order,
      ...extraListParams,
      ...filters,
    }),
    [page, pageSize, search, filters, sort, extraListParams],
  );

  const { data, isLoading, isError, error } = useList<T>(config.resource, params);
  const updateMut = useUpdate<T>(config.resource);
  const removeMut = useRemove(config.resource);

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  async function handleTogglePublish(row: T) {
    const cur = (row as { status?: string }).status;
    const next = cur === "published" ? "draft" : "published";
    try {
      await updateMut.mutateAsync({ id: row.id, payload: { status: next } });
      notifySuccess(next === "published" ? "已发布" : "已转为草稿");
    } catch (e) {
      notifyError(e, "操作失败");
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
          <Can anyPerm={perms(config, "create")}>
            <Button asChild>
              <Link href={`${config.basePath}/new`}>
                <Plus className="mr-2 h-4 w-4" />
                新增{config.singular}
              </Link>
            </Button>
          </Can>
        }
      />

      {(config.searchable || config.filters?.length) && (
        <Card className="mb-6 border-border/80 py-0 shadow-sm">
          <CardContent className="flex flex-wrap gap-3 p-4">
            {config.searchable && (
              <form
                className="relative min-w-[220px] flex-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  setPage(1);
                  setSearch(searchInput.trim());
                }}
              >
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="搜索标题…"
                  className="pl-9"
                />
              </form>
            )}
            {config.filters?.map((flt) => (
              <Select
                key={flt.key}
                value={filters[flt.key] ?? "__all__"}
                onValueChange={(v) => {
                  setPage(1);
                  setFilters((prev) => {
                    const next = { ...prev };
                    if (v && v !== "__all__") next[flt.key] = v;
                    else delete next[flt.key];
                    return next;
                  });
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
          </CardContent>
        </Card>
      )}

      {isError && (
        <Alert variant="destructive" icon="error" className="mb-4">
          加载失败：{error instanceof Error ? error.message : "未知错误"}
        </Alert>
      )}

      <DataTable
        columns={config.columns}
        rows={rows}
        loading={isLoading}
        sort={sort}
        defaultSort={config.defaultSort}
        onSortChange={(next) => {
          setPage(1);
          setSort(next);
        }}
        renderActions={(row) => (
          <div className="flex items-center justify-end gap-1">
            {config.extraActions?.(row)}
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
                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                    <a
                      href={`${WEB_BASE}${config.previewPath(row)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Eye className="h-4 w-4" />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>预览</TooltipContent>
              </Tooltip>
            )}
            {config.publishable && (
              <Can anyPerm={perms(config, "publish")}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleTogglePublish(row)}
                    >
                      {(row as { status?: string }).status === "published" ? (
                        <Undo2 className="h-4 w-4" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {(row as { status?: string }).status === "published"
                      ? "下线为草稿"
                      : "立即发布"}
                  </TooltipContent>
                </Tooltip>
              </Can>
            )}
            <Can anyPerm={perms(config, "edit")}>
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
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
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
