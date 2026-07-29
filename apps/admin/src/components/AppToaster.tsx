'use client';

import { Toaster } from '@tzj/ui';

/** 全局 Toast 容器 — 挂载于根 layout，登录页与后台共用；主题跟随 base-ui 设计令牌 */
export function AppToaster() {
  return <Toaster />;
}
