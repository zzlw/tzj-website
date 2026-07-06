"use client";

import { useRef, useState } from "react";
import { Globe, Loader2, Trash2, Upload } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@tzj/ui";
import { useFavicon, useUploadFavicon, useDeleteFavicon } from "@/features/favicon";
import { ApiError } from "@/lib/apiClient";
import { notifyError, notifySuccess } from "@/lib/notify";

const ACCEPT = ".ico,.png,.jpg,.jpeg,.webp";

export function FaviconSettingsCard() {
  const { data, isLoading } = useFavicon();
  const upload = useUploadFavicon();
  const remove = useDeleteFavicon();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const faviconUrl = data?.url ?? null;
  const busy = upload.isPending || remove.isPending;

  async function handleFile(file: File) {
    try {
      await upload.mutateAsync(file);
      notifySuccess("Favicon 已上传", "官网约 5 分钟内生效");
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : e, "上传失败");
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // reset so same file can be re-selected
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  async function onDelete() {
    try {
      await remove.mutateAsync();
      notifySuccess("Favicon 已删除");
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : e, "删除失败");
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>网站图标</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          网站图标（Favicon）
        </CardTitle>
        <CardDescription className="mt-1.5 max-w-2xl">
          浏览器标签页、书签栏和搜索引擎中显示的网站图标。支持 ICO、PNG、JPG、WebP
          格式（图片将自动转为 32×32 ICO），建议上传 256×256 以上透明 PNG。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 预览区域 */}
        <div
          className={`relative flex items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/20"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          {faviconUrl ? (
            <div className="flex flex-col items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={faviconUrl}
                alt="当前 Favicon"
                className="h-16 w-16 rounded border border-border bg-white object-contain p-1"
              />
              <span className="text-xs text-muted-foreground">当前网站图标</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Globe className="h-10 w-10 opacity-40" />
              <span className="text-sm">尚未设置 Favicon</span>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={onInputChange}
          />
          <Button
            type="button"
            variant="default"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {upload.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                上传中…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                {faviconUrl ? "更换图标" : "上传图标"}
              </>
            )}
          </Button>

          {faviconUrl && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onDelete}
              className="text-destructive hover:text-destructive"
            >
              {remove.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              删除
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          支持格式：ICO / PNG / JPG / WebP，文件大小不超过 1 MB。拖拽文件到上方区域也可上传。
        </p>
      </CardContent>
    </Card>
  );
}
