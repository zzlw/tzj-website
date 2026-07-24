'use client';

import type { ScreenWatermark } from '@tzj/types';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Slider,
  Switch,
} from '@tzj/ui';
import { Loader2, ShieldAlert } from 'lucide-react';

/** 预览用平铺水印背景（与 ScreenWatermark 组件视觉一致） */
function buildPreviewBackground(line1: string, line2: string, opacity: number): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='120'>` +
    `<g transform='rotate(-22 100 60)' fill='#0f172a' fill-opacity='${opacity}' ` +
    `font-family='sans-serif' font-size='12'>` +
    `<text x='12' y='56'>${esc(line1)}</text>` +
    `<text x='12' y='74'>${esc(line2)}</text>` +
    `</g></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

function todayLabel(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 后台防截图水印设置卡片（受控组件）。
 * 由「站点设置」页注入 value/onChange/pending/onSave，复用页面的 form/patch/save 流程。
 */
export function ScreenWatermarkSettingsCard({
  value,
  onChange,
  pending,
  onSave,
}: {
  value: ScreenWatermark;
  onChange: (next: ScreenWatermark) => void;
  pending: boolean;
  onSave: () => void;
}) {
  const prefix = value.text.trim();
  const previewLine1 = prefix ? `${prefix} · 登录账号` : '登录账号';
  const previewBg = buildPreviewBackground(previewLine1, todayLabel(), value.opacity);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            后台水印（防截图溯源）
          </CardTitle>
          <CardDescription className="mt-1.5 max-w-2xl">
            开启后，后台所有页面叠加带「登录账号 +
            日期」的半透明平铺水印，使任何截图都可追溯到具体员工，
            震慑内部信息外泄。水印不影响操作；浏览器无法真正阻止截图，此为溯源型明水印。
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Label htmlFor="screen-wm-enabled" className="text-sm text-muted-foreground">
            启用
          </Label>
          <Switch
            id="screen-wm-enabled"
            checked={value.enabled}
            onCheckedChange={(enabled) => onChange({ ...value, enabled })}
          />
        </div>
      </CardHeader>
      <CardContent className={`space-y-5 ${value.enabled ? '' : 'pointer-events-none opacity-50'}`}>
        <div>
          <Label htmlFor="screen-wm-text">自定义标识（可选）</Label>
          <Input
            id="screen-wm-text"
            className="mt-1.5"
            maxLength={64}
            placeholder="如：河南拓之迹 · 机密（留空则仅显示账号 + 日期）"
            value={value.text}
            onChange={(e) => onChange({ ...value, text: e.target.value })}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            拼接在登录账号前，用于标注密级或公司名。
          </p>
        </div>

        <div className="max-w-sm">
          <div className="flex items-center justify-between">
            <Label>透明度</Label>
            <span className="text-sm text-muted-foreground">
              {Math.round(value.opacity * 100)}%
            </span>
          </div>
          <Slider
            className="mt-3"
            min={2}
            max={30}
            step={1}
            value={[Math.round(value.opacity * 100)]}
            onValueChange={([v]) => onChange({ ...value, opacity: (v ?? 8) / 100 })}
          />
          <p className="mt-1 text-xs text-muted-foreground">建议 6%–12%，越低越不干扰阅读。</p>
        </div>

        <div>
          <Label>预览</Label>
          <div
            className="mt-1.5 h-28 w-full rounded-md border border-border bg-card"
            style={{ backgroundImage: previewBg, backgroundRepeat: 'repeat' }}
            aria-hidden="true"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            实际水印显示当前登录账号；此处「登录账号」为占位示意。
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button type="button" onClick={onSave} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              保存中…
            </>
          ) : (
            '保存设置'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
