'use client';

import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@tzj/ui';
import { Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { useState } from 'react';
import {
  useTwoFactorDisable,
  useTwoFactorRegenerate,
  useTwoFactorStatus,
} from '@/features/account';
import { notifyError, notifySuccess } from '@/lib/notify';
import { AuthenticatorGuideDialog } from './AuthenticatorGuide';
import { RecoveryCodesPanel, TwoFactorEnrollWizard } from './TwoFactorEnrollWizard';

/** 两步验证（TOTP）设置卡片：绑定向导 / 恢复码管理 / 关闭 */
export function TwoFactorCard() {
  const { data: status, isLoading } = useTwoFactorStatus();
  const disable = useTwoFactorDisable();
  const regenerate = useTwoFactorRegenerate();

  const [password, setPassword] = useState('');
  // regenerate 成功后一次性展示的恢复码
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  // 已启用视图的折叠面板：'disable' | 'regenerate' | null
  const [panel, setPanel] = useState<'disable' | 'regenerate' | null>(null);
  const [disableCode, setDisableCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);

  async function onDisable(e: React.FormEvent) {
    e.preventDefault();
    try {
      await disable.mutateAsync({
        password,
        ...(useRecovery ? { recoveryCode: disableCode.trim() } : { code: disableCode.trim() }),
      });
      setPanel(null);
      setPassword('');
      setDisableCode('');
      notifySuccess('两步验证已关闭');
    } catch (err) {
      notifyError(err, '关闭失败');
    }
  }

  async function onRegenerate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { recoveryCodes: codes } = await regenerate.mutateAsync(disableCode.trim());
      setPanel(null);
      setDisableCode('');
      setRecoveryCodes(codes);
      notifySuccess('恢复码已重新生成', '旧恢复码已全部作废');
    } catch (err) {
      notifyError(err, '生成失败');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {status?.enabled ? (
            <ShieldCheck className="h-4 w-4 text-success" />
          ) : (
            <ShieldOff className="h-4 w-4 text-muted-foreground" />
          )}
          两步验证（2FA）
        </CardTitle>
        <CardDescription>
          {status?.enabled ? (
            `已启用 · 恢复码剩余 ${status.recoveryCodesRemaining} 个`
          ) : (
            <>
              使用验证器 App（如 Microsoft Authenticator）生成动态码，为登录加一道防线。
              <AuthenticatorGuideDialog
                trigger={
                  <button type="button" className="ml-1 text-primary hover:underline">
                    查看教程
                  </button>
                }
              />
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : recoveryCodes ? (
          /* 恢复码一次性展示（regenerate 后） */
          <RecoveryCodesPanel codes={recoveryCodes} onConfirm={() => setRecoveryCodes(null)} />
        ) : status?.enabled ? (
          /* 已启用：恢复码重新生成 / 关闭 */
          <div className="space-y-4">
            {status.recoveryCodesRemaining <= 2 && (
              <Alert variant="destructive" icon="warning">
                恢复码仅剩 {status.recoveryCodesRemaining} 个，建议立即重新生成
              </Alert>
            )}
            {panel === null && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPanel('regenerate')}>
                  重新生成恢复码
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setPanel('disable')}
                >
                  关闭两步验证
                </Button>
              </div>
            )}
            {panel === 'regenerate' && (
              <form onSubmit={onRegenerate} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="regen-code">输入当前 6 位动态码（旧恢复码将全部作废）</Label>
                  <Input
                    id="regen-code"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    required
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value)}
                    placeholder="6 位数字"
                    className="max-w-40 text-center tracking-widest"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={regenerate.isPending}>
                    {regenerate.isPending ? '生成中…' : '确认生成'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPanel(null)}>
                    取消
                  </Button>
                </div>
              </form>
            )}
            {panel === 'disable' && (
              <form onSubmit={onDisable} className="space-y-3">
                <Alert variant="destructive" icon="warning">
                  关闭后登录将不再要求动态码，恢复码同时作废
                </Alert>
                <div className="space-y-2">
                  <Label htmlFor="disable-password">当前密码</Label>
                  <Input
                    id="disable-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="disable-code">{useRecovery ? '恢复码' : '6 位动态码'}</Label>
                  <Input
                    id="disable-code"
                    required
                    inputMode={useRecovery ? 'text' : 'numeric'}
                    maxLength={useRecovery ? 20 : 6}
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value)}
                    placeholder={useRecovery ? 'XXXXXXXX-XXXXXXXX' : '6 位数字'}
                    className="max-w-60"
                  />
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => {
                      setUseRecovery((v) => !v);
                      setDisableCode('');
                    }}
                  >
                    {useRecovery ? '改用动态码' : '设备不在身边？使用恢复码'}
                  </button>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    variant="destructive"
                    disabled={disable.isPending}
                  >
                    {disable.isPending ? '关闭中…' : '确认关闭'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPanel(null)}>
                    取消
                  </Button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* 未启用：走绑定向导 */
          <TwoFactorEnrollWizard />
        )}
      </CardContent>
    </Card>
  );
}
