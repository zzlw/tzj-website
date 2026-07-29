'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@tzj/ui';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useUpdateGrowthSettings } from '@/features/growth';
import { notifyError, notifySuccess } from '@/lib/notify';

interface AdSpendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 当前生效的广告花费（元），打开时预填 */
  currentAdSpend: number;
}

/**
 * 广告花费录入对话框（Phase1 手动录入）：
 * 写入 Setting KV（growth.adSpend），保存后询盘成本即时重算。
 * 后端 PUT /analytics/growth-settings 为 settings.manage 权限，调用方需用 Can 门禁包裹入口。
 */
export function AdSpendDialog({ open, onOpenChange, currentAdSpend }: AdSpendDialogProps) {
  const [value, setValue] = useState('');
  const updateSettings = useUpdateGrowthSettings();

  useEffect(() => {
    if (open) setValue(String(currentAdSpend));
  }, [open, currentAdSpend]);

  const parsed = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(parsed) && parsed >= 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    try {
      // 与后端 DTO 口径一致：最多两位小数
      await updateSettings.mutateAsync({ adSpend: Math.round(parsed * 100) / 100 });
      notifySuccess('广告花费已更新，询盘成本将按新花费重算');
      onOpenChange(false);
    } catch (err) {
      notifyError(err, '保存失败');
    }
  }

  const submitting = updateSettings.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>录入广告花费</DialogTitle>
          <DialogDescription>
            填写广告平台（Google Ads / 百度等）的实际总花费。系统按「花费 ÷
            广告询盘数」计算询盘成本。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ad-spend-input">广告花费（元）</Label>
            <Input
              id="ad-spend-input"
              type="number"
              min={0}
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="如 5000"
              required
            />
            <p className="text-xs text-muted-foreground">
              Phase1 为全局单值（非分时段），建议按当前统计周期的投放总额填写。
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button type="submit" disabled={submitting || !valid}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
