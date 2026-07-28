'use client';

import { Toaster } from '@tzj/ui';
import { useTheme } from 'next-themes';

/** 全局 Toast 容器 — 挂载于根 layout，登录页与后台共用；主题跟随 next-themes 明暗模式 */
export function AppToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme === 'dark' ? 'dark' : 'light'} position="top-center" />;
}
