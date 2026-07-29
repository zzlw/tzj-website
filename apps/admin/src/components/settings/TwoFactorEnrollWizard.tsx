'use client';

import { Alert, Button, Input, Label } from '@tzj/ui';
import { Copy } from 'lucide-react';
import { useState } from 'react';
import { type TwoFactorSetupData, useTwoFactorEnable, useTwoFactorSetup } from '@/features/account';
import { notifyError, notifySuccess } from '@/lib/notify';
import { AuthenticatorGuideCollapsible, AuthenticatorGuideDialog } from './AuthenticatorGuide';

/** 恢复码一次性展示面板（enable / regenerate 成功后共用） */
export function RecoveryCodesPanel({
  codes,
  onConfirm,
  fullWidth = false,
}: {
  codes: string[];
  onConfirm: () => void;
  /** 独立页形态：按钮撑满、常规尺寸（默认为设置页紧凑形态） */
  fullWidth?: boolean;
}) {
  async function copyCodes() {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      notifySuccess('恢复码已复制');
    } catch {
      notifyError('复制失败，请手动抄录');
    }
  }

  return (
    <div className="space-y-4">
      <Alert variant="destructive" icon="warning">
        恢复码仅此一次明文展示，请立即保存到安全位置。设备丢失时这是唯一的自助入口。
      </Alert>
      <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-muted/40 p-4 font-mono text-sm">
        {codes.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <div className={fullWidth ? 'grid grid-cols-2 gap-2' : 'flex gap-2'}>
        <Button variant="outline" size={fullWidth ? 'default' : 'sm'} onClick={copyCodes}>
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          复制全部
        </Button>
        <Button size={fullWidth ? 'default' : 'sm'} onClick={onConfirm}>
          我已保存
        </Button>
      </div>
    </div>
  );
}

/**
 * 2FA 绑定向导：输密码生成密钥 → 扫码 + 动态码确认 → 恢复码一次性展示。
 * 供设置页 TwoFactorCard 与强制绑定页 /enroll-2fa 复用。
 */

/** 两种形态（设置页紧凑 / 独立页撑满）的样式差异集中定义 */
const WIZARD_STYLES = {
  compact: {
    qrRow: 'flex flex-col items-center gap-3 sm:flex-row sm:items-start',
    qrInfo: 'space-y-2 text-sm',
    codeInput: 'max-w-40 text-center tracking-widest',
    actionRow: 'flex gap-2',
    button: undefined,
    setupForm: 'space-y-3',
    passwordLabel: '输入当前密码开始设置',
    passwordInput: 'max-w-60',
    buttonSize: 'sm',
  },
  full: {
    qrRow: 'flex flex-col items-center gap-3',
    qrInfo: 'w-full space-y-2 text-sm',
    codeInput: 'text-center tracking-widest',
    actionRow: 'flex flex-col gap-2',
    button: 'w-full',
    setupForm: 'space-y-4',
    passwordLabel: '当前密码',
    passwordInput: undefined,
    buttonSize: 'default',
  },
} as const;

export function TwoFactorEnrollWizard({
  onDone,
  fullWidth = false,
}: {
  onDone?: () => void;
  /** 独立页形态：输入框/按钮撑满卡片宽度（默认为设置页紧凑形态） */
  fullWidth?: boolean;
}) {
  const ui = WIZARD_STYLES[fullWidth ? 'full' : 'compact'];
  const setup = useTwoFactorSetup();
  const enable = useTwoFactorEnable();

  const [password, setPassword] = useState('');
  const [setupData, setSetupData] = useState<TwoFactorSetupData | null>(null);
  const [code, setCode] = useState('');
  // enable 成功后一次性展示的恢复码
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  async function onSetup(e: React.FormEvent) {
    e.preventDefault();
    try {
      const data = await setup.mutateAsync(password);
      setSetupData(data);
      setPassword('');
      setCode('');
    } catch (err) {
      notifyError(err, '生成失败');
    }
  }

  async function onEnable(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { recoveryCodes: codes } = await enable.mutateAsync(code.trim());
      setSetupData(null);
      setCode('');
      setRecoveryCodes(codes);
      notifySuccess('两步验证已启用', '其他设备的登录已被强制退出');
    } catch (err) {
      notifyError(err, '验证码错误');
    }
  }

  if (recoveryCodes) {
    return (
      <RecoveryCodesPanel
        codes={recoveryCodes}
        fullWidth={fullWidth}
        onConfirm={() => {
          setRecoveryCodes(null);
          onDone?.();
        }}
      />
    );
  }

  if (setupData) {
    /* 绑定第二步：扫码 + 输入动态码确认 */
    return (
      <form onSubmit={onEnable} className="space-y-4">
        <div className={ui.qrRow}>
          <img
            src={setupData.qrDataUrl}
            alt="TOTP 绑定二维码"
            className="h-40 w-40 rounded-md border border-border"
          />
          <div className={ui.qrInfo}>
            <p>
              1. 用验证器 App 扫描二维码；
              <AuthenticatorGuideDialog
                trigger={
                  <button type="button" className="ml-1 text-xs text-primary hover:underline">
                    不知道怎么扫？
                  </button>
                }
              />
            </p>
            <p>2. 无法扫码时手动输入密钥：</p>
            <code className="block break-all rounded bg-muted px-2 py-1 font-mono text-xs">
              {setupData.secret}
            </code>
            <p className="text-xs text-muted-foreground">二维码 15 分钟内有效，过期需重新生成</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="enable-code">输入 App 中的 6 位动态码完成绑定</Label>
          <Input
            id="enable-code"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus={fullWidth}
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6 位数字"
            className={ui.codeInput}
          />
        </div>
        <div className={ui.actionRow}>
          <Button
            type="submit"
            className={ui.button}
            disabled={enable.isPending || code.trim().length !== 6}
          >
            {enable.isPending ? '验证中…' : '确认绑定'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={ui.button}
            onClick={() => setSetupData(null)}
          >
            取消
          </Button>
        </div>
      </form>
    );
  }

  /* 绑定第一步：输入密码开始设置（表单上方先给教程，让用户在生成 15 分钟有效期的二维码前装好 App） */
  return (
    <form onSubmit={onSetup} className={ui.setupForm}>
      <AuthenticatorGuideCollapsible />
      <div className="space-y-2">
        <Label htmlFor="setup-password">{ui.passwordLabel}</Label>
        <Input
          id="setup-password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus={fullWidth}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="请输入当前密码"
          className={ui.passwordInput}
        />
        {fullWidth ? (
          <p className="text-xs text-muted-foreground">验证身份后将生成绑定二维码</p>
        ) : null}
      </div>
      <Button
        type="submit"
        size={ui.buttonSize}
        className={ui.button}
        disabled={setup.isPending || !password}
      >
        {setup.isPending ? '生成中…' : '开始设置'}
      </Button>
    </form>
  );
}
