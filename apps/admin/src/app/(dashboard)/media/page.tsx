'use client';

import {
  Alert,
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  ImagePreviewProvider,
  Input,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TablePagination,
  Tabs,
  TabsList,
  TabsTrigger,
  TooltipProvider,
} from '@tzj/ui';
import { ImageOff, Loader2, Search, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Can } from '@/components/Can';
import { WatermarkOptOutToggle } from '@/components/crud/WatermarkOptOutToggle';
import { MediaCard } from '@/components/media/MediaCard';
import { MediaPreviewDialog } from '@/components/media/MediaPreviewDialog';
import {
  formatMediaDeleteError,
  useApplyMediaWatermark,
  useDeleteMedia,
  useMediaList,
  usePurgeMedia,
  useRemoveMediaWatermark,
  useReplaceSiteMedia,
  useRestoreMedia,
  useUploadMedia,
} from '@/features/media';
import type { MediaAsset } from '@/features/types';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { ApiError } from '@/lib/apiClient';
import { notifyError, notifySuccess } from '@/lib/notify';
import { enumField, intField, stringField, useUrlState } from '@/lib/use-url-state';

const TYPE_FILTERS = [
  { label: '全部', value: '' },
  { label: '图片', value: 'image' },
  { label: '视频', value: 'video' },
  { label: '文件', value: 'file' },
];

const FOLDER_FILTERS = [
  { label: '全部', value: '' },
  { label: '站点资源', value: 'content' },
  { label: 'CMS', value: 'cms' },
] as const;

const VIEW_TABS = [
  { label: '媒体库', value: 'library' },
  { label: '回收站', value: 'trash' },
] as const;

type ViewTab = (typeof VIEW_TABS)[number]['value'];

/** 排序预设（对齐 WordPress 媒体库 / 云存储控制台惯例）；后端支持 createdAt/filename/size/updatedAt */
const SORT_OPTIONS = [
  { label: '最新上传', sortBy: 'createdAt', sortOrder: 'desc' },
  { label: '最早上传', sortBy: 'createdAt', sortOrder: 'asc' },
  { label: '文件名 A–Z', sortBy: 'filename', sortOrder: 'asc' },
  { label: '体积从大到小', sortBy: 'size', sortOrder: 'desc' },
  { label: '体积从小到大', sortBy: 'size', sortOrder: 'asc' },
] as const;

export default function MediaPage() {
  const [urlState, setUrlState] = useUrlState({
    view: enumField(['library', 'trash'] as const, 'library'),
    type: enumField(['image', 'video', 'file'] as const, ''),
    folder: enumField(['content', 'cms'] as const, ''),
    page: intField(1, { min: 1 }),
    pageSize: intField(24, { min: 1 }),
    search: stringField(),
    sortIdx: intField(0, { min: 0 }),
  });
  const { view, type, folder, page, pageSize, sortIdx } = urlState;
  const search = urlState.search;
  const [searchInput, setSearchInput] = useState(() => urlState.search || '');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<MediaAsset | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<MediaAsset | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [removeWatermarkTarget, setRemoveWatermarkTarget] = useState<MediaAsset | null>(null);
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null);
  const [skipWatermark, setSkipWatermark] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceFileRef = useRef<HTMLInputElement>(null);

  const isTrash = view === 'trash';
  const sort = SORT_OPTIONS[sortIdx] ?? SORT_OPTIONS[0];

  // 击键防抖：停止输入 300ms 后自动落地检索词并回到第 1 页（对齐文档中心，免按回车）
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300);
  const appliedSearch = urlState.search || '';
  useEffect(() => {
    if (debouncedSearch !== appliedSearch) setUrlState({ search: debouncedSearch, page: 1 });
  }, [debouncedSearch, appliedSearch, setUrlState]);

  const { data, isLoading, isError, error } = useMediaList({
    page,
    limit: pageSize,
    type: type || undefined,
    folder: folder || undefined,
    search: search || undefined,
    sortBy: sort.sortBy,
    sortOrder: sort.sortOrder,
    trash: isTrash ? 1 : undefined,
  });
  const upload = useUploadMedia();
  const remove = useDeleteMedia();
  const restore = useRestoreMedia();
  const purge = usePurgeMedia();
  const replaceSite = useReplaceSiteMedia();
  const applyWatermark = useApplyMediaWatermark();
  const removeWatermark = useRemoveMediaWatermark();

  const assets = data?.data ?? [];
  const pagination = data?.pagination;

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    let ok = 0;
    for (const file of Array.from(files)) {
      try {
        await upload.mutateAsync({ file, watermark: skipWatermark ? 'skip' : undefined });
        ok += 1;
      } catch (e) {
        notifyError(e, `「${file.name}」上传失败`);
      }
    }
    if (ok > 0) {
      notifySuccess(ok === 1 ? '上传成功' : `已上传 ${ok} 个文件`);
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      if (previewAsset?.id === deleteTarget.id) setPreviewAsset(null);
      setDeleteTarget(null);
      notifySuccess('已移入回收站');
    } catch (e) {
      notifyError(e, formatMediaDeleteError(e));
    }
  }

  async function handleRestore(asset: MediaAsset) {
    try {
      await restore.mutateAsync(asset.id);
      if (previewAsset?.id === asset.id) setPreviewAsset(null);
      notifySuccess('已恢复');
    } catch (e) {
      notifyError(e, '恢复失败');
    }
  }

  async function handlePurgeConfirm() {
    if (!purgeTarget) return;
    try {
      await purge.mutateAsync(purgeTarget.id);
      if (previewAsset?.id === purgeTarget.id) setPreviewAsset(null);
      setPurgeTarget(null);
      notifySuccess('已永久删除');
    } catch (e) {
      notifyError(e, '永久删除失败');
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
    if (replaceFileRef.current) replaceFileRef.current.value = '';
  }

  async function handleReplaceConfirm() {
    if (!replaceTarget || !replaceFile) return;
    try {
      await replaceSite.mutateAsync({ id: replaceTarget.id, file: replaceFile });
      if (previewAsset?.id === replaceTarget.id) setPreviewAsset(null);
      setReplaceTarget(null);
      setReplaceFile(null);
      notifySuccess('站点资源已替换', '若仍见旧图，请强制刷新或清除 CDN 缓存');
    } catch (e) {
      notifyError(e, '替换失败');
    }
  }

  async function handleApplyWatermark(asset: MediaAsset) {
    try {
      await applyWatermark.mutateAsync(asset.id);
      notifySuccess('已添加水印');
    } catch (e) {
      notifyError(e, '加水印失败');
    }
  }

  async function handleRemoveWatermarkConfirm() {
    if (!removeWatermarkTarget) return;
    try {
      await removeWatermark.mutateAsync(removeWatermarkTarget.id);
      setRemoveWatermarkTarget(null);
      notifySuccess('已去除水印，原图已恢复');
    } catch (e) {
      notifyError(e, '去水印失败');
    }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    notifySuccess('链接已复制');
    setTimeout(() => setCopiedUrl(null), 1500);
  }

  return (
    <TooltipProvider>
      <PageHeader
        title="媒体库"
        description={
          isTrash
            ? '回收站中的素材仍占用存储；永久删除需超级管理员权限'
            : '站点资源可「替换」；CMS 素材上传至 cms/ 目录'
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
              <div className="flex items-center gap-4">
                <WatermarkOptOutToggle
                  checked={skipWatermark}
                  onCheckedChange={setSkipWatermark}
                  disabled={upload.isPending}
                />
                <Button onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
                  {upload.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {upload.isPending ? '上传中…' : '上传文件'}
                </Button>
              </div>
            </Can>
          ) : undefined
        }
      />

      <Tabs
        value={view}
        onValueChange={(v) => {
          setUrlState({ view: v as ViewTab, type: '', page: 1 });
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
              setUrlState({ type: v as typeof type, page: 1 });
            }}
            className="mb-4"
          >
            <TabsList>
              {TYPE_FILTERS.map((t) => (
                <TabsTrigger key={t.value || 'all'} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Tabs
            value={folder}
            onValueChange={(v) => {
              setUrlState({ folder: v as typeof folder, page: 1 });
            }}
            className="mb-4"
          >
            <TabsList>
              {FOLDER_FILTERS.map((t) => (
                <TabsTrigger key={t.value || 'all-folder'} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </>
      ) : null}

      <Card className="mb-6 border-border/80 py-0">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <form
            className="relative min-w-[220px] max-w-md flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              setUrlState({ search: searchInput.trim(), page: 1 });
            }}
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="搜索文件名、文件夹、描述或对象 key…"
              className="pl-9 pr-9"
            />
            {searchInput && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="清除搜索"
                onClick={() => {
                  setSearchInput('');
                  setUrlState({ search: '', page: 1 });
                }}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>
          <Select
            value={String(sortIdx)}
            onValueChange={(v) => {
              setUrlState({ sortIdx: Number(v), page: 1 });
            }}
          >
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt, i) => (
                <SelectItem key={`${opt.sortBy}:${opt.sortOrder}`} value={String(i)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isError && (
        <Alert variant="destructive" icon="error" className="mb-4">
          加载失败：{error instanceof Error ? error.message : '未知错误'}
          {error instanceof ApiError && error.status === 401 ? '（会话已过期，请重新登录）' : null}
        </Alert>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : assets.length === 0 ? (
        <Card className="border-dashed border-border/80 py-0">
          <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
            <ImageOff className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">
              {search
                ? `未找到与「${search}」匹配的媒体`
                : isTrash
                  ? '回收站为空'
                  : '媒体库为空，点击右上角上传'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ImagePreviewProvider>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {assets.map((a) => (
              <MediaCard
                key={a.id}
                asset={a}
                mode={isTrash ? 'trash' : 'active'}
                copiedUrl={copiedUrl}
                onCopy={copyUrl}
                onDelete={setDeleteTarget}
                onPreview={setPreviewAsset}
                onReplaceSite={startReplace}
                onRestore={handleRestore}
                onPurge={setPurgeTarget}
                onApplyWatermark={handleApplyWatermark}
                onRemoveWatermark={setRemoveWatermarkTarget}
                watermarkPendingId={
                  applyWatermark.isPending
                    ? applyWatermark.variables
                    : removeWatermark.isPending
                      ? removeWatermark.variables
                      : null
                }
              />
            ))}
          </div>
        </ImagePreviewProvider>
      )}

      {pagination && (
        <TablePagination
          className="mt-6"
          page={page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          pageSize={pageSize}
          pageSizeOptions={[12, 24, 48, 96]}
          onPageChange={(p) => setUrlState({ page: p })}
          onPageSizeChange={(size) => {
            setUrlState({ pageSize: size, page: 1 });
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

      <ConfirmDialog
        open={removeWatermarkTarget !== null}
        onOpenChange={(open) => !open && setRemoveWatermarkTarget(null)}
        title="去水印"
        description={
          removeWatermarkTarget
            ? `确认去除「${removeWatermarkTarget.filename}」的水印？将从备份恢复原图；当前带水印版本会另存备份。`
            : undefined
        }
        confirmLabel="去水印"
        onConfirm={handleRemoveWatermarkConfirm}
        loading={removeWatermark.isPending}
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
