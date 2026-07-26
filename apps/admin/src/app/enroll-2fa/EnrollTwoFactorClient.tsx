'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@tzj/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { QueryProvider } from '@/components/QueryProvider';
import { TwoFactorEnrollWizard } from '@/components/settings/TwoFactorEnrollWizard';
import { BASE_PATH } from '@/lib/config';

/** 强制绑定页主体：最小外壳（logo + 居中卡片）+ 复用绑定向导 + 退出登录 */
export function EnrollTwoFactorClient() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch(`${BASE_PATH}/api/auth/logout`, { method: 'POST' });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <QueryProvider>
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md border-border/80 bg-card/95 shadow-xl backdrop-blur-sm">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-md">
              TZJ
            </div>
            <div className="space-y-1">
              <CardTitle className="text-xl">启用两步验证</CardTitle>
              <CardDescription>管理员要求启用两步验证后才能继续使用系统</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <TwoFactorEnrollWizard
              fullWidth
              onDone={() => {
                router.replace('/');
                router.refresh();
              }}
            />
            <div className="mt-6 border-t border-border/60 pt-4 text-center">
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                onClick={logout}
                disabled={loggingOut}
              >
                {loggingOut ? '退出中…' : '换个账号？退出登录'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </QueryProvider>
  );
}
