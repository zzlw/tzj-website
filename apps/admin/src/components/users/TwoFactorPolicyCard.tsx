'use client';

import { Card, CardContent, ConfirmDialog, Switch } from '@tzj/ui';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useTwoFactorStatus } from '@/features/account';
import {
  useSecurityAuthSettings,
  useUpdateSecurityAuthSettings,
} from '@/features/security-settings';
import { notifyError, notifySuccess } from '@/lib/notify';

/**
 * 两步验证策略卡片（仅超管可见）：一键强制全员启用 2FA。
 * 开启前操作者自身必须已绑定（API 侧同样有前置校验兜底）。
 */
export function TwoFactorPolicyCard() {
  const { data: settings, isLoading } = useSecurityAuthSettings();
  const { data: myStatus } = useTwoFactorStatus();
  const update = useUpdateSecurityAuthSettings();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const required = settings?.twoFactorRequired ?? false;
  const selfEnrolled = myStatus?.enabled ?? false;
  // 自身未绑定时不允许开启（关闭不受限）
  const switchDisabled = isLoading || update.isPending || (!required && !selfEnrolled);

  async function apply(next: boolean) {
    try {
      await update.mutateAsync({ twoFactorRequired: next });
      setConfirmOpen(false);
      notifySuccess(
        next ? '已强制全员启用两步验证' : '已取消强制',
        next ? '未绑定用户将被要求先完成绑定' : '未绑定用户恢复正常使用',
      );
    } catch (err) {
      notifyError(err, '更新失败');
    }
  }

  return (
    <Card className="mb-4">
      <CardContent className="flex flex-wrap items-center gap-4 py-4">
        {required ? (
          <ShieldCheck className="h-5 w-5 shrink-0 text-green-600" />
        ) : (
          <ShieldAlert className="h-5 w-5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">强制全员启用两步验证</p>
          <p className="text-xs text-muted-foreground">
            {required
              ? '已开启：未绑定两步验证的账号登录后仅能进入绑定流程'
              : '关闭中：是否启用两步验证由用户自行决定'}
            {!required && !selfEnrolled && (
              <>
                {' · '}
                <Link href="/settings/account" className="underline underline-offset-2">
                  请先为自己启用两步验证
                </Link>
                ，再强制全员开启
              </>
            )}
          </p>
        </div>
        <Switch
          checked={required}
          disabled={switchDisabled}
          onCheckedChange={(next) => {
            if (next) setConfirmOpen(true);
            else void apply(false);
          }}
          aria-label="强制全员启用两步验证"
        />
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => !open && setConfirmOpen(false)}
        title="强制全员启用两步验证"
        description="开启后，所有未绑定两步验证的账号将被强制进入绑定流程，完成绑定前无法使用其他功能。建议提前通知相关同事。"
        confirmLabel="确认开启"
        onConfirm={() => apply(true)}
        loading={update.isPending}
      />
    </Card>
  );
}
