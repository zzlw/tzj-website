'use client';

import { Toaster } from '@tzj/ui';

/** 全局 Toast 容器 — 挂载于根 layout，登录页与后台共用 */
export function AppToaster() {
  return <Toaster theme="light" position="top-center" />;
}
