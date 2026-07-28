'use client';

import type {
  SiteMediaSettings,
  WatermarkFolder,
  WatermarkLayout,
  WatermarkPosition,
} from '@tzj/types';
import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  Switch,
} from '@tzj/ui';
import { ImagePlus, Loader2, Stamp, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MediaPicker } from '@/components/crud/MediaPicker';
import {
  useSiteMediaSettings,
  useUpdateSiteMediaSettings,
  WATERMARK_LAYOUT_LABELS,
  WATERMARK_POSITION_LABELS,
  watermarkImageKeyFromUrl,
  watermarkImageUrlFromKey,
} from '@/features/site-media';
import { ApiError } from '@/lib/apiClient';
import { notifyError, notifySuccess } from '@/lib/notify';

type WatermarkPreset = {
  label: string;
  patch: Partial<SiteMediaSettings['watermark']>;
};

const WATERMARK_PRESETS: WatermarkPreset[] = [
  {
    label: '品牌角标',
    patch: {
      layout: 'corner',
      mode: 'text',
      position: 'bottom-right',
      opacity: 0.32,
      scale: 0.18,
    },
  },
  {
    label: '平铺防盗',
    patch: {
      layout: 'tile',
      mode: 'text',
      opacity: 0.14,
      scale: 0.22,
      tileSpacing: 1.5,
      tileAngle: -25,
    },
  },
  {
    label: '居中样片',
    patch: {
      layout: 'center',
      mode: 'text',
      text: '样片',
      opacity: 0.22,
      scale: 0.28,
    },
  },
];

function ModuleSaveButton({ pending, onClick }: { pending: boolean; onClick: () => void }) {
  return (
    <Button type="button" onClick={onClick} disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          保存中…
        </>
      ) : (
        '保存设置'
      )}
    </Button>
  );
}

function WatermarkLogoPicker({
  imageKey,
  onChange,
}: {
  imageKey?: string;
  onChange: (key: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const previewUrl = watermarkImageUrlFromKey(imageKey);

  return (
    <div className="flex items-start gap-3">
      {previewUrl ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="水印 Logo"
            className="h-20 w-20 rounded-md border border-border object-contain bg-muted/30 p-1"
          />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-destructive"
            aria-label="清除水印图片"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
        >
          <ImagePlus className="h-5 w-5" />
          <span className="text-xs">选择 Logo</span>
        </button>
      )}
      {previewUrl ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto px-0"
          onClick={() => setOpen(true)}
        >
          更换图片
        </Button>
      ) : null}
      <MediaPicker
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(urls) => {
          const key = watermarkImageKeyFromUrl(urls[0]);
          onChange(key);
          setOpen(false);
        }}
        accept="image"
        folder="uploads"
      />
    </div>
  );
}

function toggleFolder(folders: WatermarkFolder[], folder: WatermarkFolder): WatermarkFolder[] {
  return folders.includes(folder) ? folders.filter((f) => f !== folder) : [...folders, folder];
}

export function WatermarkSettingsCard() {
  const { data, isLoading } = useSiteMediaSettings();
  const updateMedia = useUpdateSiteMediaSettings();
  const [form, setForm] = useState<SiteMediaSettings | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  async function onSave() {
    if (!form) return;
    try {
      await updateMedia.mutateAsync(form);
      notifySuccess('媒体水印设置已保存');
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : e, '保存失败');
    }
  }

  function applyPreset(patch: Partial<SiteMediaSettings['watermark']>) {
    setForm((prev) => (prev ? { ...prev, watermark: { ...prev.watermark, ...patch } } : prev));
  }

  if (isLoading || !form) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>媒体水印</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中…
        </CardContent>
      </Card>
    );
  }

  const wm = form.watermark;

  return (
    <Card className="pb-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Stamp className="h-4 w-4 text-muted-foreground" />
          媒体水印
        </CardTitle>
        <CardDescription className="max-w-2xl">
          上传图片/视频时自动叠加水印（烧录进文件）。推荐：品牌用角标、内部资料用平铺斜纹、预览稿用居中样片。
          Logo 请用 PNG 透明底；视频需服务器安装 ffmpeg。content/ 静态资源不受影响。
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <Label htmlFor="wm-enabled" className="text-sm text-muted-foreground">
            启用
          </Label>
          <Switch
            id="wm-enabled"
            checked={wm.enabled}
            onCheckedChange={(enabled) =>
              setForm((prev) =>
                prev ? { ...prev, watermark: { ...prev.watermark, enabled } } : prev,
              )
            }
          />
        </CardAction>
      </CardHeader>
      <CardContent className={`space-y-5 ${wm.enabled ? '' : 'pointer-events-none opacity-50'}`}>
        <div className="flex flex-wrap gap-2">
          <span className="w-full text-xs text-muted-foreground">快速预设</span>
          {WATERMARK_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => applyPreset(preset.patch)}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>布局</Label>
            <Select
              value={wm.layout}
              onValueChange={(layout: WatermarkLayout) =>
                setForm((prev) =>
                  prev ? { ...prev, watermark: { ...prev.watermark, layout } } : prev,
                )
              }
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(WATERMARK_LAYOUT_LABELS) as [WatermarkLayout, string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              {wm.layout === 'corner' && '右下角低干扰品牌标识，不透明度建议 25%–35%'}
              {wm.layout === 'tile' && '斜纹平铺防盗图，不透明度建议 10%–18%，角度 -20°～-30°'}
              {wm.layout === 'center' && '居中大字样片标记，适合预览稿、未交付素材'}
            </p>
          </div>
          <div>
            <Label>水印类型</Label>
            <Select
              value={wm.mode}
              onValueChange={(mode: 'text' | 'image') =>
                setForm((prev) =>
                  prev ? { ...prev, watermark: { ...prev.watermark, mode } } : prev,
                )
              }
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">文字水印</SelectItem>
                <SelectItem value="image">Logo 图片</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {wm.layout === 'corner' ? (
          <div className="max-w-xs">
            <Label>角标位置</Label>
            <Select
              value={wm.position}
              onValueChange={(position: WatermarkPosition) =>
                setForm((prev) =>
                  prev ? { ...prev, watermark: { ...prev.watermark, position } } : prev,
                )
              }
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(WATERMARK_POSITION_LABELS) as [WatermarkPosition, string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {wm.mode === 'text' ? (
          <div>
            <Label htmlFor="wm-text">水印文字</Label>
            <Input
              id="wm-text"
              value={wm.text}
              maxLength={64}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, watermark: { ...prev.watermark, text: e.target.value } } : prev,
                )
              }
              placeholder="河南拓之迹"
              className="mt-1.5 max-w-md"
            />
          </div>
        ) : (
          <div>
            <Label>水印 Logo</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              推荐 PNG 透明背景；平铺模式下 Logo 会旋转重复排列
            </p>
            <div className="mt-2">
              <WatermarkLogoPicker
                imageKey={wm.imageKey}
                onChange={(imageKey) =>
                  setForm((prev) =>
                    prev ? { ...prev, watermark: { ...prev.watermark, imageKey } } : prev,
                  )
                }
              />
            </div>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <div className="flex items-center justify-between">
              <Label>不透明度</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {Math.round(wm.opacity * 100)}%
              </span>
            </div>
            <Slider
              className="mt-3"
              min={5}
              max={100}
              step={1}
              value={[Math.round(wm.opacity * 100)]}
              onValueChange={([v]) =>
                setForm((prev) =>
                  prev
                    ? { ...prev, watermark: { ...prev.watermark, opacity: (v ?? 14) / 100 } }
                    : prev,
                )
              }
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>{wm.layout === 'tile' ? '文字/Logo 相对大小' : '相对宽度'}</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {Math.round(wm.scale * 100)}%
              </span>
            </div>
            <Slider
              className="mt-3"
              min={5}
              max={50}
              step={1}
              value={[Math.round(wm.scale * 100)]}
              onValueChange={([v]) =>
                setForm((prev) =>
                  prev
                    ? { ...prev, watermark: { ...prev.watermark, scale: (v ?? 18) / 100 } }
                    : prev,
                )
              }
            />
          </div>
        </div>

        {wm.layout === 'tile' ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between">
                <Label>平铺间距</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {wm.tileSpacing.toFixed(1)}×
                </span>
              </div>
              <Slider
                className="mt-3"
                min={100}
                max={250}
                step={10}
                value={[Math.round(wm.tileSpacing * 100)]}
                onValueChange={([v]) =>
                  setForm((prev) =>
                    prev
                      ? {
                          ...prev,
                          watermark: { ...prev.watermark, tileSpacing: (v ?? 150) / 100 },
                        }
                      : prev,
                  )
                }
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>平铺角度</Label>
                <span className="text-xs tabular-nums text-muted-foreground">{wm.tileAngle}°</span>
              </div>
              <Slider
                className="mt-3"
                min={-45}
                max={-10}
                step={1}
                value={[wm.tileAngle]}
                onValueChange={([v]) =>
                  setForm((prev) =>
                    prev
                      ? { ...prev, watermark: { ...prev.watermark, tileAngle: v ?? -25 } }
                      : prev,
                  )
                }
              />
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="wm-min-width">最小宽度（px）</Label>
            <Input
              id="wm-min-width"
              type="number"
              min={0}
              max={10000}
              value={wm.minWidth}
              onChange={(e) =>
                setForm((prev) =>
                  prev
                    ? {
                        ...prev,
                        watermark: {
                          ...prev.watermark,
                          minWidth: Number.parseInt(e.target.value, 10) || 0,
                        },
                      }
                    : prev,
                )
              }
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-muted-foreground">小于此宽度的图片不加水印</p>
          </div>
          <div>
            <Label htmlFor="wm-min-height">最小高度（px）</Label>
            <Input
              id="wm-min-height"
              type="number"
              min={0}
              max={10000}
              value={wm.minHeight}
              onChange={(e) =>
                setForm((prev) =>
                  prev
                    ? {
                        ...prev,
                        watermark: {
                          ...prev.watermark,
                          minHeight: Number.parseInt(e.target.value, 10) || 0,
                        },
                      }
                    : prev,
                )
              }
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-4">
          <p className="text-sm font-medium">应用范围</p>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm" htmlFor="wm-apply-images">
              <Switch
                id="wm-apply-images"
                checked={wm.applyToImages}
                onCheckedChange={(applyToImages) =>
                  setForm((prev) =>
                    prev ? { ...prev, watermark: { ...prev.watermark, applyToImages } } : prev,
                  )
                }
              />
              图片（JPEG/PNG/WebP）
            </label>
            <label className="flex items-center gap-2 text-sm" htmlFor="wm-apply-videos">
              <Switch
                id="wm-apply-videos"
                checked={wm.applyToVideos}
                onCheckedChange={(applyToVideos) =>
                  setForm((prev) =>
                    prev ? { ...prev, watermark: { ...prev.watermark, applyToVideos } } : prev,
                  )
                }
              />
              视频（需 ffmpeg）
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['uploads', 'cms'] as const).map((folder) => {
              const active = wm.applyToFolders.includes(folder);
              return (
                <Button
                  key={folder}
                  type="button"
                  size="sm"
                  variant={active ? 'default' : 'outline'}
                  onClick={() =>
                    setForm((prev) => {
                      if (!prev) return prev;
                      const next = toggleFolder(prev.watermark.applyToFolders, folder);
                      if (next.length === 0) return prev;
                      return {
                        ...prev,
                        watermark: { ...prev.watermark, applyToFolders: next },
                      };
                    })
                  }
                >
                  {folder === 'uploads' ? '媒体库 uploads' : '正文 cms'}
                </Button>
              );
            })}
          </div>
        </div>
      </CardContent>
      <CardFooter className="items-center justify-end border-t bg-muted/20 px-6 pt-4! pb-4">
        <ModuleSaveButton pending={updateMedia.isPending} onClick={onSave} />
      </CardFooter>
    </Card>
  );
}
