"use client";

import {
  Download,
  ExternalLink,
  File,
  FileAudio,
  FileText,
  FileVideo,
  Copy,
  Check,
} from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@tzj/ui";
import type { MediaAsset } from "@/features/types";
import {
  downloadMediaAsset,
  formatFileSize,
  getMediaKind,
  openInNewTab,
  type MediaKind,
} from "./media-utils";
import { AudioPlayer } from "@tzj/ui";

function PreviewBody({ asset, kind }: { asset: MediaAsset; kind: MediaKind }) {
  if (kind === "video") {
    return (
      <video
        key={asset.url}
        src={asset.url}
        controls
        playsInline
        className="max-h-[min(70vh,720px)] w-full rounded-md bg-black"
        preload="metadata"
      >
        您的浏览器不支持视频播放
      </video>
    );
  }
  if (kind === "audio") {
    return (
      <div className="flex w-full flex-col items-center gap-6 py-4">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted">
          <FileAudio className="h-10 w-10 text-muted-foreground" />
        </div>
        <AudioPlayer src={asset.url} />
      </div>
    );
  }
  const Icon = kind === "pdf" ? FileText : File;
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-muted">
        <Icon className="h-12 w-12 text-muted-foreground" />
      </div>
      <p className="max-w-sm break-all text-sm text-muted-foreground">{asset.filename}</p>
      <p className="text-xs text-muted-foreground">{formatFileSize(asset.size)}</p>
    </div>
  );
}

export function MediaPreviewDialog({
  asset,
  onClose,
  copied,
  onCopy,
}: {
  asset: MediaAsset | null;
  onClose: () => void;
  copied: boolean;
  onCopy: (url: string) => void;
}) {
  const kind = asset ? getMediaKind(asset.mimeType, asset.filename) : "file";
  const showOpenInNewTab = kind !== "audio" && kind !== "video";

  return (
    <Dialog open={asset !== null} onOpenChange={(open) => !open && onClose()}>
      {asset ? (
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-border px-6 py-4 pr-12 text-left">
            <DialogTitle className="truncate pr-4">{asset.filename}</DialogTitle>
            <DialogDescription>
              {asset.mimeType} · {formatFileSize(asset.size)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted/20 p-6">
            <PreviewBody asset={asset} kind={kind} />
          </div>
          <DialogFooter className="gap-2 border-t border-border px-6 py-4 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onCopy(asset.url)}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              复制链接
            </Button>
            {showOpenInNewTab ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => openInNewTab(asset.url)}
              >
                <ExternalLink className="h-4 w-4" />
                新标签页打开
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={() => downloadMediaAsset(asset)}
            >
              <Download className="h-4 w-4" />
              下载
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

export function MediaThumbnail({
  asset,
  kind,
}: {
  asset: MediaAsset;
  kind: MediaKind;
}) {
  if (kind === "video") {
    return (
      <>
        <video
          src={asset.url}
          muted
          playsInline
          preload="metadata"
          className="pointer-events-none h-full w-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
          <FileVideo className="h-10 w-10 text-white drop-shadow" />
        </div>
      </>
    );
  }
  const Icon =
    kind === "audio" ? FileAudio : kind === "pdf" ? FileText : File;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-2 text-muted-foreground">
      <Icon className="h-10 w-10 shrink-0 opacity-70" />
      <span className="line-clamp-2 text-center text-[10px] leading-tight">
        {asset.filename}
      </span>
    </div>
  );
}
