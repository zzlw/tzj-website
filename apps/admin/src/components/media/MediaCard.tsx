'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  ImagePreview,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@tzj/ui';
import { Check, Copy, Download, ExternalLink, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { Can } from '@/components/Can';
import { isMediaDeletable } from '@/features/media';
import type { MediaAsset } from '@/features/types';
import { MediaThumbnail } from './MediaPreviewDialog';
import {
  downloadMediaAsset,
  formatFileSize,
  getMediaKind,
  openInNewTab,
  previewMediaAsset,
} from './media-utils';

function MediaStatusBadges({ asset }: { asset: MediaAsset }) {
  if (!asset.isSiteResource && !(asset.usageCount && asset.usageCount > 0)) {
    return null;
  }
  return (
    <div className="absolute bottom-1 left-1 z-10 flex flex-wrap gap-1">
      {asset.isSiteResource ? (
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
          站点资源
        </Badge>
      ) : null}
      {asset.usageCount && asset.usageCount > 0 ? (
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
          使用中 · {asset.usageCount}
        </Badge>
      ) : null}
    </div>
  );
}

export function MediaCard({
  asset,
  copiedUrl,
  onCopy,
  onDelete,
  onPreview,
  onReplaceSite,
  mode = 'active',
  onRestore,
  onPurge,
}: {
  asset: MediaAsset;
  copiedUrl: string | null;
  onCopy: (url: string) => void;
  onDelete: (asset: MediaAsset) => void;
  onPreview: (asset: MediaAsset) => void;
  onReplaceSite?: (asset: MediaAsset) => void;
  mode?: 'active' | 'trash';
  onRestore?: (asset: MediaAsset) => void;
  onPurge?: (asset: MediaAsset) => void;
}) {
  const kind = getMediaKind(asset.mimeType, asset.filename);
  const isImage = kind === 'image';
  const canDelete = isMediaDeletable(asset);

  function handleActivate() {
    previewMediaAsset(asset, { onDialog: onPreview });
  }

  function stop(e: React.MouseEvent) {
    e.stopPropagation();
  }

  const thumbInner = (
    <>
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={asset.url}
          alt={asset.alt ?? asset.filename}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          draggable={false}
        />
      ) : (
        <MediaThumbnail asset={asset} kind={kind} />
      )}
    </>
  );

  const thumb = (
    <div
      role={isImage ? undefined : 'button'}
      tabIndex={isImage ? undefined : 0}
      onClick={isImage ? undefined : handleActivate}
      onKeyDown={
        isImage
          ? undefined
          : (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleActivate();
              }
            }
      }
      className="relative block aspect-square w-full cursor-pointer overflow-hidden bg-muted/30 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={isImage ? undefined : `预览 ${asset.filename}`}
    >
      {thumbInner}
      {mode === 'active' ? <MediaStatusBadges asset={asset} /> : null}
    </div>
  );

  return (
    <Card className="group overflow-hidden border-border/80 py-0 shadow-sm transition-colors hover:border-primary/30">
      <div className="relative">
        {isImage ? <ImagePreview src={asset.url}>{thumb}</ImagePreview> : thumb}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-end gap-1 p-2 opacity-0 transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto">
          <div className="flex gap-1" onClick={stop}>
            {mode === 'active' ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7 cursor-pointer bg-background/80 backdrop-blur-sm"
                      onClick={() => onCopy(asset.url)}
                    >
                      {copiedUrl === asset.url ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>复制链接</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7 cursor-pointer bg-background/80 backdrop-blur-sm"
                      onClick={() => downloadMediaAsset(asset)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>下载</TooltipContent>
                </Tooltip>
                {kind === 'pdf' ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7 cursor-pointer bg-background/80 backdrop-blur-sm"
                        onClick={() => openInNewTab(asset.url)}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>新标签页预览</TooltipContent>
                  </Tooltip>
                ) : null}
                {asset.isReplaceable ? (
                  <Can perm="media.replaceSite">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-7 w-7 cursor-pointer bg-background/80 backdrop-blur-sm hover:border-primary/60 hover:bg-primary hover:text-primary-foreground"
                          onClick={() => onReplaceSite?.(asset)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>替换站点资源</TooltipContent>
                    </Tooltip>
                  </Can>
                ) : null}
                <Can perm="media.delete">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          size="icon"
                          variant="secondary"
                          disabled={!canDelete}
                          className="h-7 w-7 cursor-pointer bg-background/80 backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-40"
                          onClick={() => canDelete && onDelete(asset)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {canDelete
                        ? '移入回收站'
                        : asset.isSiteResource
                          ? '站点资源不可删除'
                          : '内容引用中，不可删除'}
                    </TooltipContent>
                  </Tooltip>
                </Can>
              </>
            ) : (
              <>
                <Can perm="media.delete">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7 cursor-pointer bg-background/80 backdrop-blur-sm"
                        onClick={() => onRestore?.(asset)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>恢复</TooltipContent>
                  </Tooltip>
                </Can>
                <Can perm="media.purge">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7 cursor-pointer bg-background/80 backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => onPurge?.(asset)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>永久删除</TooltipContent>
                  </Tooltip>
                </Can>
              </>
            )}
          </div>
        </div>
      </div>
      <CardContent className="cursor-default p-2.5">
        <p className="truncate text-xs font-medium" title={asset.filename}>
          {asset.filename}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{formatFileSize(asset.size)}</p>
      </CardContent>
    </Card>
  );
}
