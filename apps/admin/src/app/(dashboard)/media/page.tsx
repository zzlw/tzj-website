"use client";

import { useRef, useState } from "react";
import { ImageOff, Loader2, Search, Upload, X } from "lucide-react";
import { PhotoProvider } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";
import "@/components/media/photo-view-overrides.css";
import {
  Alert,
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  Input,
  PageHeader,
  Tabs,
  TabsList,
  TabsTrigger,
  TooltipProvider,
  TablePagination,
} from "@tzj/ui";
import { Can } from "@/components/Can";
import {
  formatMediaDeleteError,
  useMediaList,
  useUploadMedia,
  useDeleteMedia,
  useRestoreMedia,
  usePurgeMedia,
  useReplaceSiteMedia,
} from "@/features/media";
import { ApiError } from "@/lib/apiClient";
import type { MediaAsset } from "@/features/types";
import { MediaCard } from "@/components/media/MediaCard";
import { MediaPreviewDialog } from "@/components/media/MediaPreviewDialog";

const TYPE_FILTERS = [
  { label: "全部", value: "" },
  { label: "图片", value: "image" },
  { label: "视频", value: "video" },
  { label: "文件", value: "file" },
];

const FOLDER_FILTERS = [
  { label: "全部", value: "" },
  { label: "站点资源", value: "content" },
  { label: "CMS", value: "cms" },
] as const;

const VIEW_TABS = [
  { label: "媒体库", value: "library" },
  { label: "回收站", value: "trash" },
] as const;

type ViewTab = (typeof VIEW_TABS)[number]["value"];

export default function MediaPage() {
  const [view, setView] = useState<ViewTab>("library");
  const [type, setType] = useState("");
  const [folder, setFolder] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<MediaAsset | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<MediaAsset | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceFileRef = useRef<HTMLInputElement>(null);

  const isTrash = view === "trash";

  const { data, isLoading, isError, error } = useMediaList({
    page,
    limit: pageSize,
    type: type || undefined,
    folder: folder || undefined,
    search: search || undefined,
    trash: isTrash ? 1 : undefined,
  });
  const upload = useUploadMedia();
  const remove = useDeleteMedia();
  const restore = useRestoreMedia();
  const purge = usePurgeMedia();
  const replaceSite = useReplaceSiteMedia();

  const assets = data?.data ?? [];
  const pagination = data?.pagination;

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      try {
        await upload.mutateAsync(file);
      } catch (e) {
        alert(e instanceof ApiError ? e.message : "上传失败");
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      if (previewAsset?.id === deleteTarget.id) setPreviewAsset(null);
      setDeleteTarget(null);
    } catch (e) {
      alert(formatMediaDeleteError(e));
    }
  }

  async function handleRestore(asset: MediaAsset) {
    try {
      await restore.mutateAsync(asset.id);
      if (previewAsset?.id === asset.id) setPreviewAsset(null);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "恢复失败");
    }
  }

  async function handlePurgeConfirm() {
    if (!purgeTarget) return;
    try {
      await purge.mutateAsync(purgeTarget.id);
      if (previewAsset?.id === purgeTarget.id) setPreviewAsset(null);
      setPurgeTarget(null);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "永久删除失败");
    }
  }

  function startReplace(asset: MediaAsset) {
    setReplaceTarget(asset);
    replaceFileRef.current?.click();
  }

  function onReplaceFilePicked(files: FileList | null) {
    const file = files?.[0];
    if (!file || !replaceTarget) {
      setReplaceTarget(null);
      return;
    }
    setReplaceFile(file);
    if (replaceFileRef.current) replaceFileRef.current.value = "";
  }

  async function handleReplaceConfirm() {
    if (!replaceTarget || !replaceFile) return;
    try {
      await replaceSite.mutateAsync({ id: replaceTarget.id, file: replaceFile });
      if (previewAsset?.id === replaceTarget.id) setPreviewAsset(null);
      setReplaceTarget(null);
      setReplaceFile(null);
      alert("站点资源已替换。若浏览器仍显示旧图，请强制刷新或清除 CDN 缓存。");
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "替换失败");
    }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 1500);
  }

  return (
    <TooltipProvider>
      <PageHeader
        title="媒体库"
        description={
          isTrash
            ? "回收站中的素材仍占用存储；永久删除需超级管理员权限"
            : "站点资源可「替换」；CMS 素材上传至 cms/ 目录"
        }
        action={
          !isTrash ? (
            <Can perm="media.upload">
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => onFiles(e.target.files)}
              />
              <Button
                onClick={() => fileRef.current?.click()}
                disabled={upload.isPending}
              >
                {upload.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {upload.isPending ? "上传中…" : "上传文件"}
              </Button>
            </Can>
          ) : undefined
        }
      />

      <Tabs
        value={view}
        onValueChange={(v) => {
          setView(v as ViewTab);
          setPage(1);
          setType("");
        }}
        className="mb-4"
      >
        <TabsList>
          {VIEW_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {!isTrash ? (
        <>
          <Tabs
            value={type}
            onValueChange={(v) => {
              setType(v);
              setPage(1);
            }}
            className="mb-4"
          >
            <TabsList>
              {TYPE_FILTERS.map((t) => (
                <TabsTrigger key={t.value || "all"} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Tabs
            value={folder}
            onValueChange={(v) => {
              setFolder(v);
              setPage(1);
            }}
            className="mb-4"
          >
            <TabsList>
              {FOLDER_FILTERS.map((t) => (
                <TabsTrigger key={t.value || "all-folder"} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </>
      ) : null}

      <Card className="mb-6 border-border/80 py-0 shadow-sm">
        <CardContent className="p-4">
          <form
            className="relative max-w-md"
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
              placeholder="搜索文件名、文件夹、描述…"
              className="pl-9 pr-9"
            />
            {searchInput && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="清除搜索"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setPage(1);
                }}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>
        </CardContent>
      </Card>

      {isError && (
        <Alert variant="destructive" icon="error" className="mb-4">
          加载失败：{error instanceof Error ? error.message : "未知错误"}
          {error instanceof ApiError && error.status === 401
            ? "（会话已过期，请重新登录）"
            : null}
        </Alert>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : assets.length === 0 ? (
        <Card className="border-dashed border-border/80">
          <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
            <ImageOff className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">
              {search
                ? `未找到与「${search}」匹配的媒体`
                : isTrash
                  ? "回收站为空"
                  : "媒体库为空，点击右上角上传"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <PhotoProvider
          maskOpacity={0.85}
          toolbarRender={({ onScale, scale, rotate, onRotate, onClose }) => (
            <div className="flex items-center gap-1 text-white">
              <button
                type="button"
                className="cursor-pointer rounded px-2 py-1 text-sm hover:bg-white/10"
                onClick={() => onScale(scale + 0.5)}
              >
                放大
              </button>
              <button
                type="button"
                className="cursor-pointer rounded px-2 py-1 text-sm hover:bg-white/10"
                onClick={() => onScale(Math.max(0.5, scale - 0.5))}
              >
                缩小
              </button>
              <button
                type="button"
                className="cursor-pointer rounded px-2 py-1 text-sm hover:bg-white/10"
                onClick={() => onRotate(rotate + 90)}
              >
                旋转
              </button>
              <span className="mx-1 h-4 w-px bg-white/20" aria-hidden />
              <button
                type="button"
                className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-sm hover:bg-white/10"
                onClick={() => onClose()}
                aria-label="关闭预览"
              >
                <X className="h-4 w-4" />
                关闭
              </button>
            </div>
          )}
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {assets.map((a) => (
              <MediaCard
                key={a.id}
                asset={a}
                mode={isTrash ? "trash" : "active"}
                copiedUrl={copiedUrl}
                onCopy={copyUrl}
                onDelete={setDeleteTarget}
                onPreview={setPreviewAsset}
                onReplaceSite={startReplace}
                onRestore={handleRestore}
                onPurge={setPurgeTarget}
              />
            ))}
          </div>
        </PhotoProvider>
      )}

      {pagination && (
        <TablePagination
          className="mt-6"
          page={page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          pageSize={pageSize}
          pageSizeOptions={[12, 24, 48, 96]}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          unit="项"
        />
      )}

      <MediaPreviewDialog
        asset={previewAsset}
        onClose={() => setPreviewAsset(null)}
        copied={copiedUrl === previewAsset?.url}
        onCopy={copyUrl}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="移入回收站"
        description={
          deleteTarget
            ? `确认将「${deleteTarget.filename}」移入回收站？文件仍保留在存储中，可从回收站恢复或永久删除。`
            : undefined
        }
        confirmLabel="移入回收站"
        onConfirm={handleDeleteConfirm}
        loading={remove.isPending}
      />

      <ConfirmDialog
        open={purgeTarget !== null}
        onOpenChange={(open) => !open && setPurgeTarget(null)}
        title="永久删除"
        description={
          purgeTarget
            ? `确认永久删除「${purgeTarget.filename}」？存储对象将被清除，此操作不可撤销。`
            : undefined
        }
        confirmLabel="永久删除"
        onConfirm={handlePurgeConfirm}
        loading={purge.isPending}
      />

      <input
        ref={replaceFileRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => onReplaceFilePicked(e.target.files)}
      />

      <ConfirmDialog
        open={replaceTarget !== null && replaceFile !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReplaceTarget(null);
            setReplaceFile(null);
          }
        }}
        title="替换站点资源"
        description={
          replaceTarget && replaceFile
            ? `将用「${replaceFile.name}」覆盖「${replaceTarget.filename}」（key: ${replaceTarget.key}）。旧文件会备份至 content/_archive/，URL 不变。`
            : undefined
        }
        confirmLabel="确认替换"
        onConfirm={handleReplaceConfirm}
        loading={replaceSite.isPending}
      />
    </TooltipProvider>
  );
}
