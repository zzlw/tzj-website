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
import {
  Check,
  Copy,
  Download,
  Droplets,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldOff,
  ShieldPlus,
  Trash2,
} from 'lucide-react';
import { Can } from '@/components/Can';
import { isMediaDeletable } from '@/features/media';
import type { MediaAsset } from '@/features/types';
import { MediaThumbnail } from './MediaPreviewDialog';
import { mediaPreviewUrl } from './media-preview-url';
import {
  downloadMediaAsset,
  formatFileSize,
  getMediaKind,
  openInNewTab,
  previewMediaAsset,
} from './media-utils';

function MediaStatusBadges({ asset }: { asset: MediaAsset }) {
  const hasWatermark = asset.watermarked === true;
  if (!asset.isSiteResource && !(asset.usageCount && asset.usageCount > 0) && !hasWatermark) {
    return null;
  }
  return (
    <div className="absolute bottom-1 left-1 z-10 flex flex-wrap gap-1">
      {asset.isSiteResource ? (
        <Badge variant="secondary" className="h-5 px-1.5 text-xs">
          站点资源
        </Badge>
      ) : null}
      {asset.usageCount && asset.usageCount > 0 ? (
        <Badge variant="secondary" className="h-5 px-1.5 text-xs">
          使用中 · {asset.usageCount}
        </Badge>
      ) : null}
      {hasWatermark ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="h-5 gap-0.5 px-1.5 text-xs">
              <Droplets className="h-3 w-3" />
              水印
            </Badge>
          </TooltipTrigger>
          <TooltipContent>已烧录水印</TooltipContent>
        </Tooltip>
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
  onApplyWatermark,
  onRemoveWatermark,
  watermarkPendingId,
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
  /** 加水印：原图备份后同 key 烧录覆盖（需 media.upload） */
  onApplyWatermark?: (asset: MediaAsset) => void;
  /** 去水印：从 _archive 最新备份恢复（需 media.upload，由页面层弹确认框） */
  onRemoveWatermark?: (asset: MediaAsset) => void;
  /** 正在执行水印操作的资产 ID（展示 loading） */
  watermarkPendingId?: string | null;
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
          src={mediaPreviewUrl(asset.url, asset.updatedAt)}
          alt={asset.alt ?? asset.filename}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          draggable={false}
        />
      ) : (
        <MediaThumbnail asset={asset} kind={kind} />
      )}
    </>
  );

  const thumbCls =
    'relative block aspect-square w-full cursor-pointer overflow-hidden bg-muted/30 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
  const thumbBody = (
    <>
      {thumbInner}
      {mode === 'active' ? <MediaStatusBadges asset={asset} /> : null}
    </>
  );
  // 图片由 ImagePreview 包裹接管交互；非图片用真按钮承载点击/键盘激活
  const thumb = isImage ? (
    <div className={thumbCls}>{thumbBody}</div>
  ) : (
    <button
      type="button"
      onClick={handleActivate}
      className={thumbCls}
      aria-label={`预览 ${asset.filename}`}
    >
      {thumbBody}
    </button>
  );

  return (
    <Card className="group gap-0 overflow-hidden border-border/80 py-0 transition-colors hover:border-primary/30">
      <div className="relative">
        {isImage ? (
          <ImagePreview src={mediaPreviewUrl(asset.url, asset.updatedAt)}>{thumb}</ImagePreview>
        ) : (
          thumb
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-end gap-1 p-2 opacity-0 transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto">
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: 仅阻断冒泡避免触发缩略图预览，非交互控件 */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: 同上，冒泡阻断容器 */}
          <div className="flex gap-1" onClick={stop}>
            {mode === 'active' ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon-xs"
                      variant="secondary"
                      className="cursor-pointer bg-background/80 backdrop-blur-sm"
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
                      size="icon-xs"
                      variant="secondary"
                      className="cursor-pointer bg-background/80 backdrop-blur-sm"
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
                        size="icon-xs"
                        variant="secondary"
                        className="cursor-pointer bg-background/80 backdrop-blur-sm"
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
                          size="icon-xs"
                          variant="secondary"
                          className="cursor-pointer bg-background/80 backdrop-blur-sm hover:border-primary/60 hover:bg-primary hover:text-primary-foreground"
                          onClick={() => onReplaceSite?.(asset)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>替换站点资源</TooltipContent>
                    </Tooltip>
                  </Can>
                ) : null}
                {kind === 'image' || kind === 'video' ? (
                  <Can perm="media.upload">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon-xs"
                          variant="secondary"
                          disabled={watermarkPendingId === asset.id}
                          className="cursor-pointer bg-background/80 backdrop-blur-sm"
                          onClick={() =>
                            asset.watermarked === true
                              ? onRemoveWatermark?.(asset)
                              : onApplyWatermark?.(asset)
                          }
                        >
                          {watermarkPendingId === asset.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : asset.watermarked === true ? (
                            <ShieldOff className="h-3.5 w-3.5" />
                          ) : (
                            <ShieldPlus className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {asset.watermarked === true ? '去水印' : '加水印'}
                      </TooltipContent>
                    </Tooltip>
                  </Can>
                ) : null}
                <Can perm="media.delete">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          size="icon-xs"
                          variant="secondary"
                          disabled={!canDelete}
                          className="cursor-pointer bg-background/80 backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-40"
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
                        size="icon-xs"
                        variant="secondary"
                        className="cursor-pointer bg-background/80 backdrop-blur-sm"
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
                        size="icon-xs"
                        variant="secondary"
                        className="cursor-pointer bg-background/80 backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground"
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
        <p className="mt-0.5 text-xs text-muted-foreground">{formatFileSize(asset.size)}</p>
      </CardContent>
    </Card>
  );
}
