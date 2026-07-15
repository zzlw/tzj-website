'use client';

import type { SitePublicSettings } from '@tzj/types';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  cn,
  ImagePreview,
  ImagePreviewProvider,
  Input,
  Label,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '@tzj/ui';
import { Clock, ImagePlus, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MediaPicker } from '@/components/crud/MediaPicker';
import { useSitePublicSettings, useUpdateSitePublicSettings } from '@/features/site-settings';
import { ApiError } from '@/lib/apiClient';
import { normalizeSocialQrForSave, resolveMediaUrl } from '@/lib/media-url';
import { notifyError, notifySuccess } from '@/lib/notify';

/** 客服在线时间配置：星期选项（0=周日 … 6=周六） */
const WEEKDAYS: { value: number; label: string }[] = [
  { value: 0, label: '日' },
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
];

/** 客服在线时间配置：常用业务时区 */
const TIMEZONES: { id: string; label: string }[] = [
  { id: 'Asia/Shanghai', label: 'Asia/Shanghai（中国）' },
  { id: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong（香港）' },
  { id: 'Asia/Taipei', label: 'Asia/Taipei（台湾）' },
  { id: 'Asia/Singapore', label: 'Asia/Singapore（新加坡）' },
  { id: 'Asia/Tokyo', label: 'Asia/Tokyo（东京）' },
  { id: 'America/New_York', label: 'America/New_York（美东）' },
  { id: 'Europe/London', label: 'Europe/London（伦敦）' },
  { id: 'UTC', label: 'UTC' },
];

/** 0–23 小时选项 */
const HOURS = Array.from({ length: 24 }, (_, h) => h);

function AgentAvatarField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const displayUrl = value ? resolveMediaUrl(value) : '';

  return (
    <div className="flex items-center gap-3">
      {value ? (
        <div className="relative h-16 w-16 overflow-hidden rounded-full border border-border">
          <ImagePreview src={displayUrl}>
            <button
              type="button"
              className="block h-full w-full cursor-pointer overflow-hidden"
              aria-label="预览头像"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayUrl}
                alt=""
                className="h-full w-full object-cover transition-opacity hover:opacity-90"
                draggable={false}
              />
            </button>
          </ImagePreview>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="absolute right-0.5 top-0.5 z-10 rounded-full bg-black/60 p-0.5 text-white hover:bg-red-500"
            aria-label="移除头像"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-full border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
        >
          <ImagePlus className="h-5 w-5" />
          <span className="text-xs">选择</span>
        </button>
      )}
      {value ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-primary hover:underline"
        >
          更换图片
        </button>
      ) : null}
      <MediaPicker
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(urls) => {
          if (urls[0]) onChange(normalizeSocialQrForSave(urls[0]));
          setOpen(false);
        }}
        accept="image"
        folder="uploads"
      />
    </div>
  );
}

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

export default function ChatSettingsPage() {
  const { data, isLoading, isError, error } = useSitePublicSettings();
  const updateSettings = useUpdateSitePublicSettings();
  const [form, setForm] = useState<SitePublicSettings | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  function patch(fn: (prev: SitePublicSettings) => SitePublicSettings) {
    setForm((prev) => (prev ? fn(prev) : prev));
  }

  async function savePublicSettings(successMessage: string) {
    if (!form) return;
    try {
      await updateSettings.mutateAsync(form);
      notifySuccess(successMessage, '官网约 5 分钟内生效');
    } catch (e) {
      notifyError(e, '保存失败');
    }
  }

  if (isLoading || !form) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof ApiError ? error.message : '加载失败'}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="客服设置"
        description="集中管理在线客服的资料与在线时间。修改后 C 端聊天窗口自动更新（约 5 分钟缓存）。"
      />

      <ImagePreviewProvider>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImagePlus className="h-4 w-4" />
                在线客服资料
              </CardTitle>
              <CardDescription>
                配置聊天窗口中客服的头像、昵称、角色与首条招呼语；留空头像将使用昵称首字兜底
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>客服头像</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  建议正方形图片；留空则使用昵称首字作为头像
                </p>
                <div className="mt-1.5">
                  <AgentAvatarField
                    value={form.agentProfile.avatar}
                    onChange={(avatar) =>
                      patch((p) => ({
                        ...p,
                        agentProfile: { ...p.agentProfile, avatar },
                      }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="agent-name">客服昵称</Label>
                  <Input
                    id="agent-name"
                    value={form.agentProfile.name}
                    onChange={(e) =>
                      patch((p) => ({
                        ...p,
                        agentProfile: { ...p.agentProfile, name: e.target.value },
                      }))
                    }
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="agent-title">角色 / 职称</Label>
                  <Input
                    id="agent-title"
                    value={form.agentProfile.title}
                    onChange={(e) =>
                      patch((p) => ({
                        ...p,
                        agentProfile: { ...p.agentProfile, title: e.target.value },
                      }))
                    }
                    className="mt-1.5"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="agent-greeting">首条招呼语</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  用户打开聊天时展示的第一句话，支持换行
                </p>
                <Textarea
                  id="agent-greeting"
                  className="mt-1.5 text-sm"
                  rows={3}
                  value={form.agentProfile.greeting}
                  onChange={(e) =>
                    patch((p) => ({
                      ...p,
                      agentProfile: { ...p.agentProfile, greeting: e.target.value },
                    }))
                  }
                />
              </div>
            </CardContent>
            <CardFooter className="items-center justify-end border-t bg-muted/20 px-6 py-4">
              <ModuleSaveButton
                pending={updateSettings.isPending}
                onClick={() => savePublicSettings('客服资料已保存')}
              />
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  客服在线时间
                </CardTitle>
                <CardDescription>
                  非工作时间（含节假日）时，访客端聊天自动提示「已离线 ·
                  留言后回复」。关闭则始终显示在线。
                </CardDescription>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Label htmlFor="bh-enabled" className="text-sm text-muted-foreground">
                  启用
                </Label>
                <Switch
                  id="bh-enabled"
                  checked={form.businessHours.enabled}
                  onCheckedChange={(enabled) =>
                    patch((p) => ({
                      ...p,
                      businessHours: { ...p.businessHours, enabled },
                    }))
                  }
                />
              </div>
            </CardHeader>
            <CardContent
              className={`space-y-4 ${form.businessHours.enabled ? '' : 'pointer-events-none opacity-50'}`}
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>业务时区</Label>
                  <Select
                    value={form.businessHours.timezone}
                    onValueChange={(timezone: string) =>
                      patch((p) => ({
                        ...p,
                        businessHours: { ...p.businessHours, timezone },
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.id} value={tz.id}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>开始时间</Label>
                  <Select
                    value={String(form.businessHours.startHour)}
                    onValueChange={(v: string) =>
                      patch((p) => ({
                        ...p,
                        businessHours: {
                          ...p.businessHours,
                          startHour: Number(v),
                        },
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((h) => (
                        <SelectItem key={h} value={String(h)}>
                          {String(h).padStart(2, '0')}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>结束时间</Label>
                  <Select
                    value={String(form.businessHours.endHour)}
                    onValueChange={(v: string) =>
                      patch((p) => ({
                        ...p,
                        businessHours: {
                          ...p.businessHours,
                          endHour: Number(v),
                        },
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((h) => (
                        <SelectItem key={h} value={String(h)}>
                          {String(h).padStart(2, '0')}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>工作日</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {WEEKDAYS.map((d) => {
                    const active = form.businessHours.weekdays.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          patch((p) => {
                            const set = new Set(p.businessHours.weekdays);
                            if (set.has(d.value)) set.delete(d.value);
                            else set.add(d.value);
                            return {
                              ...p,
                              businessHours: {
                                ...p.businessHours,
                                weekdays: [...set].sort((a, b) => a - b),
                              },
                            };
                          })
                        }
                        className={cn(
                          'h-9 w-9 rounded-md border text-sm transition',
                          active
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border text-muted-foreground hover:border-primary/50',
                        )}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label htmlFor="bh-holidays">节假日（每行一个，格式 MM-DD）</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  命中节假日的当天将视为非工作时间，如 10-01、01-01、05-01
                </p>
                <Textarea
                  id="bh-holidays"
                  className="mt-1.5 font-mono text-sm"
                  rows={3}
                  value={form.businessHours.holidays.join('\n')}
                  onChange={(e) =>
                    patch((p) => ({
                      ...p,
                      businessHours: {
                        ...p.businessHours,
                        holidays: e.target.value
                          .split('\n')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      },
                    }))
                  }
                  placeholder={'10-01\n01-01\n05-01'}
                />
              </div>
            </CardContent>
            <CardFooter className="items-center justify-end border-t bg-muted/20 px-6 py-4">
              <ModuleSaveButton
                pending={updateSettings.isPending}
                onClick={() => savePublicSettings('客服在线时间已保存')}
              />
            </CardFooter>
          </Card>
        </div>
      </ImagePreviewProvider>
    </div>
  );
}
