'use client';

import {
  Button,
  ImagePreview,
  ImagePreviewProvider,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SimpleDialog,
  TablePagination,
} from '@tzj/ui';
import { Check, Eye, ImageOff, Loader2, Search, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Can } from '@/components/Can';
import { MediaPreviewDialog } from '@/components/media/MediaPreviewDialog';
import { getMediaKind } from '@/components/media/media-utils';
import {
  formatMediaDeleteError,
  isMediaDeletable,
  useDeleteMedia,
  useMediaList,
  useUploadMedia,
} from '@/features/media';
import type { MediaAsset } from '@/features/types';
import { notifyError, notifySuccess } from '@/lib/notify';

const PAGE_SIZE_OPTIONS = [24, 48, 96] as const;
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: '最新上传' },
  { value: 'createdAt:asc', label: '最早上传' },
  { value: 'filename:asc', label: '文件名 A→Z' },
  { value: 'filename:desc', label: '文件名 Z→A' },
  { value: 'size:desc', label: '文件大小 ↓' },
  { value: 'size:asc', label: '文件大小 ↑' },
] as const;

function parseSort(value: string): { sortBy: string; sortOrder: string } {
  const [sortBy = 'createdAt', sortOrder = 'desc'] = value.split(':');
  return { sortBy, sortOrder: sortOrder === 'asc' ? 'asc' : 'desc' };
}

function MediaPickerTile({
  asset,
  selected,
  onSelect,
  onPreview,
  onDelete,
}: {
  asset: MediaAsset;
  selected: boolean;
  onSelect: () => void;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const kind = getMediaKind(asset.mimeType, asset.filename);
  const isImage = kind === 'image';
  const canDelete = isMediaDeletable(asset);

  const actionButtonClass =
    'flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-border/60 bg-background/90 text-foreground shadow-sm backdrop-blur-sm transition-colors';
  const previewButtonClass = `${actionButtonClass} hover:border-primary/60 hover:bg-primary hover:text-primary-foreground`;
  const deleteButtonClass = `${actionButtonClass} hover:border-destructive/60 hover:bg-destructive hover:text-destructive-foreground`;

  return (
    <div className="group flex flex-col gap-1">
      <div className="relative">
        <button
          type="button"
          onClick={onSelect}
          className={`relative aspect-square w-full overflow-hidden rounded-sm border ${
            selected ? 'border-primary ring-2 ring-primary/40' : 'border-border'
          } bg-background transition-colors hover:border-primary/60`}
        >
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.url}
              alt={asset.alt ?? asset.filename}
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center break-all px-1 text-center text-xs text-muted-foreground">
              {asset.filename}
            </span>
          )}
          {selected && (
            <span className="absolute bottom-1 left-1 rounded-full bg-primary p-0.5">
              <Check className="h-3 w-3 text-primary-foreground" />
            </span>
          )}
          {asset.isSiteResource ? (
            <span className="absolute left-1 top-1 rounded bg-background/90 px-1 py-0.5 text-xs text-muted-foreground">
              站点
            </span>
          ) : asset.usageCount && asset.usageCount > 0 ? (
            <span className="absolute left-1 top-1 rounded bg-background/90 px-1 py-0.5 text-xs text-muted-foreground">
              使用中
            </span>
          ) : null}
        </button>
        <div className="absolute right-1 top-1 z-10 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {isImage ? (
            <ImagePreview src={asset.url}>
              <button
                type="button"
                aria-label="预览"
                className={previewButtonClass}
                onClick={(e) => e.stopPropagation()}
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
            </ImagePreview>
          ) : (
            <button
              type="button"
              aria-label="预览"
              className={previewButtonClass}
              onClick={(e) => {
                e.stopPropagation();
                onPreview();
              }}
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          )}
          <Can perm="media.delete">
            {canDelete ? (
              <button
                type="button"
                aria-label="移入回收站"
                className={deleteButtonClass}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </Can>
        </div>
      </div>
      {isImage ? (
        <p className="truncate px-0.5 text-xs leading-tight text-foreground" title={asset.filename}>
          {asset.filename}
        </p>
      ) : null}
    </div>
  );
}

export function MediaPicker({
  open,
  onClose,
  onSelect,
  accept = 'image',
  multiple = false,
  folder = 'uploads',
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (urls: string[]) => void;
  accept?: 'image' | 'all';
  multiple?: boolean;
  folder?: string;
}) {
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState<string>(SORT_OPTIONS[0].value);
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
  const [dismissCooldown, setDismissCooldown] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dismissBlocked =
    photoPreviewOpen || dismissCooldown || previewAsset !== null || deleteTarget !== null;
  const dialogModal = !photoPreviewOpen && previewAsset === null;

  function armDismissCooldown() {
    setDismissCooldown(true);
    queueMicrotask(() => setDismissCooldown(false));
  }

  function handlePhotoVisibleChange(visible: boolean) {
    setPhotoPreviewOpen(visible);
    if (!visible) armDismissCooldown();
  }

  function closePreviewDialog() {
    setPreviewAsset(null);
    armDismissCooldown();
  }

  function handleDialogClose() {
    if (dismissBlocked) return;
    onClose();
  }

  const { sortBy, sortOrder } = parseSort(sort);

  const { data, isLoading, isFetching } = useMediaList({
    page,
    limit: pageSize,
    type: accept === 'image' ? 'image' : undefined,
    search: search || undefined,
    sortBy,
    sortOrder,
  });
  const upload = useUploadMedia(folder);
  const remove = useDeleteMedia();

  const assets = data?.data ?? [];
  const pagination = data?.pagination;
  const loading = isLoading || isFetching;
  const hasSelection = selectedUrls.length > 0;

  useEffect(() => {
    if (open) {
      setSelectedUrls([]);
      setPage(1);
      setPageSize(DEFAULT_PAGE_SIZE);
      setSearch('');
      setSearchInput('');
      setSort(SORT_OPTIONS[0].value);
      setPreviewAsset(null);
      setDeleteTarget(null);
      setPhotoPreviewOpen(false);
      setDismissCooldown(false);
    }
  }, [open]);

  useEffect(() => {
    if (!deleteTarget) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape' || remove.isPending) return;
      e.preventDefault();
      e.stopPropagation();
      setDeleteTarget(null);
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [deleteTarget, remove.isPending]);

  function selectAsset(asset: MediaAsset) {
    if (multiple) {
      setSelectedUrls((prev) =>
        prev.includes(asset.url) ? prev.filter((u) => u !== asset.url) : [...prev, asset.url],
      );
      return;
    }
    setSelectedUrls([asset.url]);
  }

  function openPreview(asset: MediaAsset) {
    const kind = getMediaKind(asset.mimeType, asset.filename);
    if (kind === 'image') return;
    setPreviewAsset(asset);
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    let ok = 0;
    for (const file of Array.from(files)) {
      try {
        await upload.mutateAsync(file);
        ok += 1;
      } catch (e) {
        notifyError(e, `「${file.name}」上传失败`);
      }
    }
    if (ok > 0) notifySuccess(ok === 1 ? '上传成功' : `已上传 ${ok} 个文件`);
    if (fileRef.current) fileRef.current.value = '';
    setPage(1);
  }

  function confirm() {
    if (!hasSelection) return;
    onSelect(selectedUrls);
    setSelectedUrls([]);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      setSelectedUrls((prev) => prev.filter((u) => u !== deleteTarget.url));
      if (previewAsset?.id === deleteTarget.id) setPreviewAsset(null);
      setDeleteTarget(null);
      notifySuccess('已移入回收站');
    } catch (e) {
      notifyError(e, formatMediaDeleteError(e));
    }
  }

  function copyUrl(url: string) {
    void navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    notifySuccess('链接已复制');
    setTimeout(() => setCopiedUrl(null), 1500);
  }

  const deleteConfirmOverlay = deleteTarget ? (
    // biome-ignore lint/a11y/useKeyWithClickEvents: 点击遮罩关闭是冗余途径，键盘用户经「取消」按钮关闭
    // biome-ignore lint/a11y/noStaticElementInteractions: 同上，遮罩层非交互控件
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={() => {
        if (!remove.isPending) setDeleteTarget(null);
      }}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: 仅阻断冒泡避免点击内容区关闭弹窗 */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: 同上，冒泡阻断容器 */}
      <div
        className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-lg"
        role="alertdialog"
        aria-labelledby="media-delete-title"
        aria-describedby="media-delete-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="media-delete-title" className="text-lg font-semibold">
          移入回收站
        </h3>
        <p id="media-delete-desc" className="mt-2 text-sm text-muted-foreground">
          确认将「{deleteTarget.filename}」移入回收站？可从媒体库回收站恢复。
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={remove.isPending}
            onClick={() => setDeleteTarget(null)}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => void handleDeleteConfirm()}
          >
            {remove.isPending ? '处理中…' : '移入回收站'}
          </Button>
        </div>
      </div>
    </div>
  ) : undefined;

  return (
    <>
      <ImagePreviewProvider onVisibleChange={handlePhotoVisibleChange}>
        <SimpleDialog
          open={open}
          onClose={handleDialogClose}
          dismissBlocked={dismissBlocked}
          modal={dialogModal}
          title="选择媒体"
          xl
          overlay={deleteConfirmOverlay}
          footer={
            <div className="flex w-full flex-col gap-4">
              {pagination && pagination.total > 0 ? (
                <TablePagination
                  className="mt-0 border-t-0 pt-0"
                  page={page}
                  totalPages={pagination.totalPages}
                  total={pagination.total}
                  pageSize={pageSize}
                  pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                  unit="项"
                />
              ) : null}
              <div className="flex w-full items-center justify-end gap-2 border-t border-border pt-4">
                {multiple ? (
                  <span className="mr-auto text-xs text-muted-foreground">
                    已选 {selectedUrls.length} 项
                  </span>
                ) : null}
                <Button type="button" variant="outline" onClick={handleDialogClose}>
                  取消
                </Button>
                <Button type="button" onClick={confirm} disabled={!hasSelection}>
                  确定
                </Button>
              </div>
            </div>
          }
        >
          <div className="mb-4">
            <input
              ref={fileRef}
              type="file"
              accept={accept === 'image' ? 'image/*' : undefined}
              multiple
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={upload.isPending}
            >
              {upload.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {upload.isPending ? '上传中…' : '上传新文件'}
            </Button>
            {upload.isError && (
              <p className="mt-2 text-xs text-destructive">
                上传失败：{(upload.error as Error)?.message}
              </p>
            )}
          </div>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <form
              className="relative min-w-0 flex-1"
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
                placeholder="搜索文件名、文件夹…"
                className="pl-9 pr-9"
              />
              {searchInput && (
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="清除搜索"
                  onClick={() => {
                    setSearchInput('');
                    setSearch('');
                    setPage(1);
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </form>
            <Select
              value={sort}
              onValueChange={(v) => {
                setSort(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-full sm:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading && assets.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Loader2 className="inline h-5 w-5 animate-spin" />
            </div>
          ) : assets.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <ImageOff className="mx-auto mb-2 h-6 w-6 opacity-50" />
              {search ? `未找到与「${search}」匹配的媒体` : '媒体库为空，请先上传'}
            </div>
          ) : (
            <div
              className={`grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 ${loading ? 'opacity-60' : ''}`}
            >
              {assets.map((a) => (
                <MediaPickerTile
                  key={a.id}
                  asset={a}
                  selected={selectedUrls.includes(a.url)}
                  onSelect={() => selectAsset(a)}
                  onPreview={() => openPreview(a)}
                  onDelete={() => setDeleteTarget(a)}
                />
              ))}
            </div>
          )}
        </SimpleDialog>
      </ImagePreviewProvider>

      <MediaPreviewDialog
        asset={previewAsset}
        onClose={closePreviewDialog}
        copied={previewAsset !== null && copiedUrl === previewAsset.url}
        onCopy={copyUrl}
      />
    </>
  );
}
