'use client';

import type {
  AnalyticsGeoMode,
  AnalyticsIpGeoSource,
  PrimaryPhoneKey,
  SiteNotificationSettings,
  SitePublicSettings,
  SocialChannelPurpose,
  SocialChannelSetting,
  SocialHrefAction,
  SocialPlatformId,
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
} from '@tzj/ui';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  ImagePlus,
  Loader2,
  Mail,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { MediaPicker } from '@/components/crud/MediaPicker';
import { RichHint } from '@/components/RichHint';
import { FaviconSettingsCard } from '@/components/settings/FaviconSettingsCard';
import { ScreenWatermarkSettingsCard } from '@/components/settings/ScreenWatermarkSettingsCard';
import { WatermarkSettingsCard } from '@/components/settings/WatermarkSettingsCard';
import {
  useSiteNotificationSettings,
  useUpdateSiteNotificationSettings,
} from '@/features/site-notifications';
import {
  useCacheTtl,
  useSitePublicSettings,
  useUpdateCacheTtl,
  useUpdateSitePublicSettings,
} from '@/features/site-settings';
import { GPS_GEO_MODE_HINT, IP_GEO_SOURCES } from '@/lib/analytics-geo-hints';
import { ApiError } from '@/lib/apiClient';
import { formatCacheTtl } from '@/lib/cache-ttl';
import { normalizeSocialQrForSave, resolveMediaUrl } from '@/lib/media-url';
import { notifyError, notifySuccess } from '@/lib/notify';

const PLATFORMS: { id: SocialPlatformId; label: string }[] = [
  { id: 'wechat', label: '微信' },
  { id: 'douyin', label: '抖音' },
  { id: 'weibo', label: '微博' },
  { id: 'xiaohongshu', label: '小红书' },
];

const PURPOSES: { id: SocialChannelPurpose; label: string; hint: string }[] = [
  { id: 'contact', label: '联系/客服', hint: 'C 端展示于「即时沟通」，文案「扫码添加」' },
  { id: 'follow', label: '社媒关注', hint: 'C 端展示于「关注我们」，文案「扫码关注」' },
];

const HREF_ACTIONS: { id: SocialHrefAction; label: string; hint: string }[] = [
  { id: 'open', label: '链接跳转', hint: '点击后新窗口打开外链' },
  { id: 'copy', label: '复制', hint: '点击后复制内容并提示用户' },
];

function defaultPurpose(platform: SocialPlatformId): SocialChannelPurpose {
  return platform === 'wechat' ? 'contact' : 'follow';
}

const GEO_MODES: { id: AnalyticsGeoMode; label: string; hint: string }[] = [
  {
    id: 'ip',
    label: 'IP 定位（推荐）',
    hint: '服务端按所选数据源解析（离线优先默认 / BigDataCloud / 高德），无需用户授权',
  },
  {
    id: 'gps',
    label: 'GPS 定位',
    hint: GPS_GEO_MODE_HINT,
  },
];

function newChannel(platform: SocialPlatformId, sortOrder: number): SocialChannelSetting {
  return {
    id: `${platform}-${Date.now()}`,
    platform,
    purpose: defaultPurpose(platform),
    enabled: true,
    sortOrder,
  };
}

function QrImageField({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const displayUrl = value ? resolveMediaUrl(value) : '';

  return (
    <div className="flex items-center gap-3">
      {value ? (
        <div className="relative h-20 w-20 overflow-hidden rounded-sm border border-border">
          <ImagePreview src={displayUrl}>
            <button
              type="button"
              className="block h-full w-full cursor-pointer overflow-hidden"
              aria-label="预览二维码"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayUrl}
                alt=""
                className="h-full w-full object-contain transition-opacity hover:opacity-90"
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
            className="absolute right-1 top-1 z-10 rounded-full bg-black/60 p-0.5 text-white hover:bg-red-500"
            aria-label="移除二维码"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
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

export default function SiteSettingsPage() {
  const { data, isLoading, isError, error } = useSitePublicSettings();
  const updateSettings = useUpdateSitePublicSettings();
  const { data: notifyData, isLoading: notifyLoading } = useSiteNotificationSettings();
  const updateNotifications = useUpdateSiteNotificationSettings();
  const [form, setForm] = useState<SitePublicSettings | null>(null);
  const [notifyForm, setNotifyForm] = useState<SiteNotificationSettings | null>(null);
  const { data: ttlData } = useCacheTtl();
  const updateTtl = useUpdateCacheTtl();
  const [ttlInput, setTtlInput] = useState('');

  useEffect(() => {
    if (ttlData) setTtlInput(String(ttlData.ttl));
  }, [ttlData]);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  useEffect(() => {
    if (notifyData) setNotifyForm(notifyData);
  }, [notifyData]);

  function patch(fn: (prev: SitePublicSettings) => SitePublicSettings) {
    setForm((prev) => (prev ? fn(prev) : prev));
  }

  async function savePublicSettings(successMessage: string) {
    if (!form) return;
    try {
      await updateSettings.mutateAsync(form);
      notifySuccess(successMessage, `官网${formatCacheTtl(ttlData?.ttl)}`);
    } catch (e) {
      notifyError(e, '保存失败');
    }
  }

  async function saveCacheTtl() {
    const ttl = Number(ttlInput);
    if (!Number.isInteger(ttl) || ttl < 0 || ttl > 86_400) {
      notifyError('请输入 0-86400 之间的整数（秒）');
      return;
    }
    try {
      await updateTtl.mutateAsync(ttl);
      notifySuccess('缓存时长已保存', `官网${formatCacheTtl(ttl)}`);
    } catch (e) {
      notifyError(e, '保存失败');
    }
  }

  async function onSaveNotifications() {
    if (!notifyForm) return;
    const notifyEmails = notifyForm.contact.notifyEmails.map((item) => item.trim()).filter(Boolean);
    if (notifyForm.enabled && notifyEmails.length === 0) {
      notifyError('启用邮件通知时请至少配置一个收件邮箱');
      return;
    }
    try {
      await updateNotifications.mutateAsync({
        ...notifyForm,
        contact: { ...notifyForm.contact, notifyEmails },
      });
      notifySuccess('邮件通知设置已保存');
    } catch (e) {
      notifyError(e, '保存失败');
    }
  }

  if (isLoading || !form || notifyLoading || !notifyForm) {
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

  const channels = [...form.social.channels].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-6">
      <PageHeader
        title="站点设置"
        description={`管理官网联系方式、ICP 备案与社交媒体。修改后官网${formatCacheTtl(ttlData?.ttl)}。`}
      />

      <div className="space-y-6">
        <Card className="pb-0">
          <CardHeader>
            <CardTitle>联系方式</CardTitle>
            <CardDescription>展示于页脚、联系页与结构化数据</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="phone">服务热线（电话一）</Label>
              <Input
                id="phone"
                value={form.contact.phone}
                onChange={(e) =>
                  patch((p) => ({ ...p, contact: { ...p.contact, phone: e.target.value } }))
                }
                placeholder="0371-58691119"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="phone-alt">备用电话（电话二，选填）</Label>
              <Input
                id="phone-alt"
                value={form.contact.phoneAlt ?? ''}
                onChange={(e) =>
                  patch((p) => ({ ...p, contact: { ...p.contact, phoneAlt: e.target.value } }))
                }
                placeholder="选填，留空则不展示"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="primaryPhone">主电话</Label>
              <Select
                value={form.contact.primaryPhone ?? 'phone'}
                onValueChange={(primaryPhone: PrimaryPhoneKey) =>
                  patch((p) => ({ ...p, contact: { ...p.contact, primaryPhone } }))
                }
              >
                <SelectTrigger id="primaryPhone" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">电话一（{form.contact.phone || '未填写'}）</SelectItem>
                  <SelectItem value="phoneAlt">
                    电话二（{form.contact.phoneAlt?.trim() || '未填写'}）
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-xs text-muted-foreground">
                主电话用于官网「点击咨询」无客服在线时的兜底拨号；两个号码均会在官网展示
              </p>
            </div>
            <div>
              <Label htmlFor="email">电子邮箱</Label>
              <Input
                id="email"
                type="email"
                value={form.contact.email}
                onChange={(e) =>
                  patch((p) => ({ ...p, contact: { ...p.contact, email: e.target.value } }))
                }
                className="mt-1.5"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="addr-cn">公司地址（简体中文）</Label>
              <Input
                id="addr-cn"
                value={form.contact.address['zh-CN'] ?? ''}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    contact: {
                      ...p.contact,
                      address: { ...p.contact.address, 'zh-CN': e.target.value },
                    },
                  }))
                }
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="addr-tw">公司地址（繁体中文）</Label>
              <Input
                id="addr-tw"
                value={form.contact.address['zh-TW'] ?? ''}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    contact: {
                      ...p.contact,
                      address: { ...p.contact.address, 'zh-TW': e.target.value },
                    },
                  }))
                }
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="addr-en">公司地址（English）</Label>
              <Input
                id="addr-en"
                value={form.contact.address.en ?? ''}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    contact: {
                      ...p.contact,
                      address: { ...p.contact.address, en: e.target.value },
                    },
                  }))
                }
                className="mt-1.5"
              />
            </div>
          </CardContent>
          <CardFooter className="items-center justify-end border-t bg-muted/20 px-6 pt-4! pb-4">
            <ModuleSaveButton
              pending={updateSettings.isPending}
              onClick={() => savePublicSettings('联系方式已保存')}
            />
          </CardFooter>
        </Card>

        <Card className="pb-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              邮件通知
            </CardTitle>
            <CardDescription>
              新询盘自动邮件提醒相关负责人；若访客填写了邮箱，可发送自动确认邮件。需先在
              <a href="/settings/integrations" className="mx-1 text-primary hover:underline">
                集成与凭证
              </a>
              中启用「阿里云邮件推送」。
            </CardDescription>
            <CardAction className="flex items-center gap-2">
              <Label htmlFor="notify-enabled" className="text-sm text-muted-foreground">
                启用
              </Label>
              <Switch
                id="notify-enabled"
                checked={notifyForm.enabled}
                onCheckedChange={(enabled) =>
                  setNotifyForm((prev) => (prev ? { ...prev, enabled } : prev))
                }
              />
            </CardAction>
          </CardHeader>
          <CardContent
            className={`space-y-4 ${notifyForm.enabled ? '' : 'pointer-events-none opacity-50'}`}
          >
            <div>
              <Label>询盘通知收件人</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                每条新询盘会向以下邮箱各发送一封通知（最多 10 个）
              </p>
              <ul className="mt-2 space-y-2">
                {notifyForm.contact.notifyEmails.map((email, index) => (
                  <li key={index} className="flex gap-2">
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) =>
                        setNotifyForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                contact: {
                                  ...prev.contact,
                                  notifyEmails: prev.contact.notifyEmails.map((item, i) =>
                                    i === index ? e.target.value : item,
                                  ),
                                },
                              }
                            : prev,
                        )
                      }
                      placeholder="sales@example.com"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive"
                      disabled={notifyForm.contact.notifyEmails.length <= 1}
                      onClick={() =>
                        setNotifyForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                contact: {
                                  ...prev.contact,
                                  notifyEmails: prev.contact.notifyEmails.filter(
                                    (_, i) => i !== index,
                                  ),
                                },
                              }
                            : prev,
                        )
                      }
                      aria-label="删除邮箱"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
              {notifyForm.contact.notifyEmails.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() =>
                    setNotifyForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            contact: {
                              ...prev.contact,
                              notifyEmails: [...prev.contact.notifyEmails, ''],
                            },
                          }
                        : prev,
                    )
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  添加收件人
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div>
                <p className="text-sm font-medium">访客自动确认邮件</p>
                <p className="text-xs text-muted-foreground">
                  访客在表单中填写邮箱时，自动发送「我们已收到您的留言」确认信
                </p>
              </div>
              <Switch
                checked={notifyForm.contact.autoReplyEnabled}
                onCheckedChange={(autoReplyEnabled) =>
                  setNotifyForm((prev) =>
                    prev ? { ...prev, contact: { ...prev.contact, autoReplyEnabled } } : prev,
                  )
                }
              />
            </div>

            {notifyForm.contact.autoReplyEnabled && (
              <div>
                <Label htmlFor="autoReplySubject">自动回复主题（可选）</Label>
                <Input
                  id="autoReplySubject"
                  value={notifyForm.contact.autoReplySubject ?? ''}
                  onChange={(e) =>
                    setNotifyForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            contact: {
                              ...prev.contact,
                              autoReplySubject: e.target.value.trim() || undefined,
                            },
                          }
                        : prev,
                    )
                  }
                  placeholder="我们已收到您的留言 — 拓之迹"
                  className="mt-1.5"
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="items-center justify-end border-t bg-muted/20 px-6 pt-4! pb-4">
            <ModuleSaveButton
              pending={updateNotifications.isPending}
              onClick={onSaveNotifications}
            />
          </CardFooter>
        </Card>

        <WatermarkSettingsCard />

        <FaviconSettingsCard />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              官网生效速度
            </CardTitle>
            <CardDescription className="mt-1.5 max-w-2xl">
              官网（C 端）读取站点设置时的缓存时长。保存联系方式、客服资料、Favicon
              等内容后，官网最长在此时长后生效；设为 0 则每次访问实时读取（不缓存）。
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-[200px_1fr]">
            <div>
              <Label htmlFor="cache-ttl">缓存时长（秒）</Label>
              <Input
                id="cache-ttl"
                type="number"
                min={0}
                max={86_400}
                step={30}
                value={ttlInput}
                onChange={(e) => setTtlInput(e.target.value)}
                placeholder="300"
                className="mt-1.5"
              />
            </div>
            <div className="sm:pt-7">
              <p className="text-xs text-muted-foreground">
                默认 300 秒（5 分钟）。改动后最长 1 分钟内按新时长生效，内容按新时长缓存。
              </p>
            </div>
          </CardContent>
          <CardFooter className="items-center justify-end border-t bg-muted/20 px-6 pt-4! pb-4">
            <ModuleSaveButton pending={updateTtl.isPending} onClick={saveCacheTtl} />
          </CardFooter>
        </Card>

        <Card className="pb-0">
          <CardHeader>
            <CardTitle>备案信息</CardTitle>
            <CardDescription>展示于页脚，链接至工信部 / 公安备案查询</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="beian">ICP 备案号</Label>
              <Input
                id="beian"
                value={form.legal.beian}
                onChange={(e) =>
                  patch((p) => ({ ...p, legal: { ...p.legal, beian: e.target.value } }))
                }
                placeholder="豫ICP备XXXXXXXX号"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="beianUrl">备案查询链接</Label>
              <Input
                id="beianUrl"
                value={form.legal.beianUrl}
                onChange={(e) =>
                  patch((p) => ({ ...p, legal: { ...p.legal, beianUrl: e.target.value } }))
                }
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="gonganBeian">公安备案号</Label>
              <Input
                id="gonganBeian"
                value={form.legal.gonganBeian ?? ''}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    legal: { ...p.legal, gonganBeian: e.target.value },
                  }))
                }
                placeholder="豫公网安备41010702004123号"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="gonganBeianUrl">公安备案查询链接</Label>
              <Input
                id="gonganBeianUrl"
                value={form.legal.gonganBeianUrl ?? ''}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    legal: { ...p.legal, gonganBeianUrl: e.target.value },
                  }))
                }
                placeholder="https://beian.mps.gov.cn/#/query/webSearch"
                className="mt-1.5"
              />
            </div>
          </CardContent>
          <CardFooter className="items-center justify-end border-t bg-muted/20 px-6 pt-4! pb-4">
            <ModuleSaveButton
              pending={updateSettings.isPending}
              onClick={() => savePublicSettings('备案信息已保存')}
            />
          </CardFooter>
        </Card>

        <Card className="pb-0">
          <CardHeader>
            <CardTitle>访客分析</CardTitle>
            <CardDescription>控制官网 C 端访客地区数据的采集方式</CardDescription>
          </CardHeader>
          <CardContent className="max-w-xl">
            <Label htmlFor="geoMode">地区定位方式</Label>
            <Select
              value={form.analytics.geoMode}
              onValueChange={(geoMode: AnalyticsGeoMode) =>
                patch((p) => ({
                  ...p,
                  analytics: { ...p.analytics, geoMode },
                }))
              }
            >
              <SelectTrigger id="geoMode" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GEO_MODES.map((mode) => (
                  <SelectItem key={mode.id} value={mode.id}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <RichHint
              text={GEO_MODES.find((m) => m.id === form.analytics.geoMode)?.hint ?? ''}
              className="mt-2 text-xs text-muted-foreground"
            />
            {form.analytics.geoMode === 'ip' && (
              <>
                <Label htmlFor="ipGeoSource" className="mt-5 block">
                  IP 定位数据源
                </Label>
                <Select
                  value={form.analytics.ipGeoSource ?? 'offline'}
                  onValueChange={(ipGeoSource: AnalyticsIpGeoSource) =>
                    patch((p) => ({
                      ...p,
                      analytics: { ...p.analytics, ipGeoSource },
                    }))
                  }
                >
                  <SelectTrigger id="ipGeoSource" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IP_GEO_SOURCES.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <RichHint
                  text={IP_GEO_SOURCES.find((s) => s.id === form.analytics.ipGeoSource)?.hint ?? ''}
                  className="mt-2 text-xs text-muted-foreground"
                />
              </>
            )}
            <Label htmlFor="baiduHmId" className="mt-5 block">
              百度统计站点 ID
            </Label>
            <Input
              id="baiduHmId"
              className="mt-1.5"
              placeholder="如 018d0a41e7842e20b4cfa398f03259e2，留空则不加载百度统计"
              value={form.analytics.baiduHmId ?? ''}
              onChange={(e) =>
                patch((p) => ({
                  ...p,
                  analytics: { ...p.analytics, baiduHmId: e.target.value },
                }))
              }
            />
            <RichHint
              text={
                '百度统计 hm.js 的站点 ID（hash）。在[百度统计](https://tongji.baidu.com)「管理 → 代码获取」中查看。留空则官网不加载统计脚本；此处配置优先于部署环境变量。'
              }
              className="mt-2 text-xs text-muted-foreground"
            />
          </CardContent>
          <CardFooter className="items-center justify-end border-t bg-muted/20 px-6 pt-4! pb-4">
            <ModuleSaveButton
              pending={updateSettings.isPending}
              onClick={() => savePublicSettings('访客分析设置已保存')}
            />
          </CardFooter>
        </Card>

        <Card className="pb-0">
          <CardHeader>
            <CardTitle>社交媒体</CardTitle>
            <CardDescription>
              按用途分组展示：客服微信归「联系/客服」，抖音/公众号等归「社媒关注」
            </CardDescription>
            <CardAction>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  patch((p) => ({
                    ...p,
                    social: {
                      channels: [
                        ...p.social.channels,
                        newChannel('wechat', p.social.channels.length),
                      ],
                    },
                  }))
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                添加渠道
              </Button>
            </CardAction>
          </CardHeader>
          <ImagePreviewProvider>
            <CardContent className="space-y-4">
              {channels.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无社媒渠道，点击「添加渠道」</p>
              ) : null}
              {channels.map((channel, index) => (
                <div key={channel.id} className="rounded-md border border-border p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={channel.enabled}
                        onCheckedChange={(enabled) =>
                          patch((p) => ({
                            ...p,
                            social: {
                              channels: p.social.channels.map((c) =>
                                c.id === channel.id ? { ...c, enabled } : c,
                              ),
                            },
                          }))
                        }
                      />
                      <span className="text-sm font-medium">
                        {PLATFORMS.find((p) => p.id === channel.platform)?.label ??
                          channel.platform}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={index === 0}
                        onClick={() => {
                          patch((p) => {
                            const list = [...p.social.channels].sort(
                              (a, b) => a.sortOrder - b.sortOrder,
                            );
                            const i = list.findIndex((c) => c.id === channel.id);
                            if (i <= 0) return p;
                            [list[i - 1]!, list[i]!] = [list[i]!, list[i - 1]!];
                            return {
                              ...p,
                              social: {
                                channels: list.map((c, idx) => ({ ...c, sortOrder: idx })),
                              },
                            };
                          });
                        }}
                        aria-label="上移"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={index === channels.length - 1}
                        onClick={() => {
                          patch((p) => {
                            const list = [...p.social.channels].sort(
                              (a, b) => a.sortOrder - b.sortOrder,
                            );
                            const i = list.findIndex((c) => c.id === channel.id);
                            if (i < 0 || i >= list.length - 1) return p;
                            [list[i]!, list[i + 1]!] = [list[i + 1]!, list[i]!];
                            return {
                              ...p,
                              social: {
                                channels: list.map((c, idx) => ({ ...c, sortOrder: idx })),
                              },
                            };
                          });
                        }}
                        aria-label="下移"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() =>
                          patch((p) => ({
                            ...p,
                            social: {
                              channels: p.social.channels.filter((c) => c.id !== channel.id),
                            },
                          }))
                        }
                        aria-label="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <div>
                      <Label>平台</Label>
                      <Select
                        value={channel.platform}
                        onValueChange={(platform: SocialPlatformId) =>
                          patch((p) => ({
                            ...p,
                            social: {
                              channels: p.social.channels.map((c) =>
                                c.id === channel.id
                                  ? {
                                      ...c,
                                      platform,
                                      purpose: c.purpose ?? defaultPurpose(platform),
                                    }
                                  : c,
                              ),
                            },
                          }))
                        }
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PLATFORMS.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>用途</Label>
                      <Select
                        value={channel.purpose ?? defaultPurpose(channel.platform)}
                        onValueChange={(purpose: SocialChannelPurpose) =>
                          patch((p) => ({
                            ...p,
                            social: {
                              channels: p.social.channels.map((c) =>
                                c.id === channel.id ? { ...c, purpose } : c,
                              ),
                            },
                          }))
                        }
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PURPOSES.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {
                          PURPOSES.find(
                            (p) => p.id === (channel.purpose ?? defaultPurpose(channel.platform)),
                          )?.hint
                        }
                      </p>
                    </div>
                    <div>
                      <Label>二维码图片</Label>
                      <div className="mt-1.5">
                        <QrImageField
                          value={channel.qr}
                          onChange={(qr) =>
                            patch((p) => ({
                              ...p,
                              social: {
                                channels: p.social.channels.map((c) =>
                                  c.id === channel.id ? { ...c, qr: qr || undefined } : c,
                                ),
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="whitespace-nowrap">触发方式</Label>
                      <Select
                        value={channel.hrefAction ?? 'open'}
                        onValueChange={(hrefAction: SocialHrefAction) =>
                          patch((p) => ({
                            ...p,
                            social: {
                              channels: p.social.channels.map((c) =>
                                c.id === channel.id ? { ...c, hrefAction } : c,
                              ),
                            },
                          }))
                        }
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HREF_ACTIONS.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {HREF_ACTIONS.find((a) => a.id === (channel.hrefAction ?? 'open'))?.hint}
                      </p>
                    </div>
                    <div>
                      <Label className="whitespace-nowrap">
                        {channel.hrefAction === 'copy' ? '复制内容（可选）' : '外链（可选）'}
                      </Label>
                      <Input
                        value={channel.href ?? ''}
                        onChange={(e) =>
                          patch((p) => ({
                            ...p,
                            social: {
                              channels: p.social.channels.map((c) =>
                                c.id === channel.id
                                  ? { ...c, href: e.target.value.trim() || undefined }
                                  : c,
                              ),
                            },
                          }))
                        }
                        placeholder={
                          channel.hrefAction === 'copy'
                            ? '如：tzj-service（点击后复制的内容）'
                            : 'https://weibo.com/...'
                        }
                        className="mt-1.5"
                      />
                      {channel.hrefAction === 'copy' ? (
                        <>
                          <Label className="mt-3 block">点击后提示语</Label>
                          <Input
                            value={channel.copyHint ?? ''}
                            onChange={(e) =>
                              patch((p) => ({
                                ...p,
                                social: {
                                  channels: p.social.channels.map((c) =>
                                    c.id === channel.id
                                      ? { ...c, copyHint: e.target.value.trim() || undefined }
                                      : c,
                                  ),
                                },
                              }))
                            }
                            placeholder="如：已复制微信号"
                            className="mt-1.5"
                          />
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </ImagePreviewProvider>
          <CardFooter className="items-center justify-end border-t bg-muted/20 px-6 pt-4! pb-4">
            <ModuleSaveButton
              pending={updateSettings.isPending}
              onClick={() => savePublicSettings('社交媒体已保存')}
            />
          </CardFooter>
        </Card>

        <ScreenWatermarkSettingsCard
          value={form.screenWatermark}
          onChange={(next) => patch((p) => ({ ...p, screenWatermark: next }))}
          pending={updateSettings.isPending}
          onSave={() => savePublicSettings('后台水印设置已保存')}
        />
      </div>
    </div>
  );
}
