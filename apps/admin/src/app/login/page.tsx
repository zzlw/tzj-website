'use client';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@tzj/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthenticatorGuideDialog } from '@/components/settings/AuthenticatorGuide';
import { BASE_PATH } from '@/lib/config';
import { notifyError } from '@/lib/notify';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // 2FA 第二步：pendingToken 非空即进入验证码环节
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);

  function gotoDashboard() {
    const from = params.get('from');
    router.replace(from && from.startsWith('/') ? from : '/');
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${BASE_PATH}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        notifyError(body.message || '登录失败，请检查账号或密码');
        return;
      }
      if (body.requires2fa && body.pendingToken) {
        setPendingToken(body.pendingToken);
        setCode('');
        setUseRecovery(false);
        return;
      }
      gotoDashboard();
    } catch {
      notifyError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingToken) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE_PATH}/api/auth/verify-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pendingToken,
          ...(useRecovery ? { recoveryCode: code.trim() } : { code: code.trim() }),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        notifyError(body.message || '验证失败，请重试');
        // 预鉴权令牌失效（超时/尝试过多）→ 退回第一步重走密码关
        if (res.status === 401 && /重新登录/.test(body.message || '')) {
          setPendingToken(null);
          setPassword('');
        }
        return;
      }
      if (body.warning) notifyError(body.warning);
      gotoDashboard();
    } catch {
      notifyError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-border/80 bg-card/95 shadow-xl backdrop-blur-sm">
        <CardHeader className="gap-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-md">
            TZJ
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl">{pendingToken ? '两步验证' : '管理后台登录'}</CardTitle>
            <CardDescription>
              {pendingToken ? '请输入验证器 App 中的 6 位动态码' : '拓之迹企业内容管理系统'}
            </CardDescription>
            {pendingToken ? (
              <AuthenticatorGuideDialog
                trigger={
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    找不到验证码？查看使用教程
                  </button>
                }
              />
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {pendingToken ? (
            <form className="space-y-4" onSubmit={onVerify}>
              <div className="space-y-2">
                <Label htmlFor="twofa-code">{useRecovery ? '恢复码' : '动态验证码'}</Label>
                <Input
                  id="twofa-code"
                  type="text"
                  name="twofa-code"
                  required
                  autoFocus
                  autoComplete="one-time-code"
                  inputMode={useRecovery ? 'text' : 'numeric'}
                  pattern={useRecovery ? undefined : '\\d{6}'}
                  maxLength={useRecovery ? 20 : 6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={useRecovery ? 'XXXXXXXX-XXXXXXXX' : '6 位数字'}
                  className="text-center tracking-widest"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading || !code.trim()}>
                {loading ? '验证中…' : '验证并登录'}
              </Button>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  onClick={() => {
                    setUseRecovery((v) => !v);
                    setCode('');
                  }}
                >
                  {useRecovery ? '改用动态验证码' : '设备不在身边？使用恢复码'}
                </button>
                <button
                  type="button"
                  className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  onClick={() => {
                    setPendingToken(null);
                    setCode('');
                    setPassword('');
                  }}
                >
                  返回重新登录
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="username">账号</Label>
                <Input
                  id="username"
                  type="text"
                  name="username"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="用户名 / 邮箱 / 手机号"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  name="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? '登录中…' : '登录'}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} 河南拓之迹实业有限公司
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
