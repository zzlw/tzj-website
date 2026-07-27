'use client';

import type { ScreenWatermark as ScreenWatermarkConfig } from '@tzj/types';
import { ScrollArea, SidebarInset, SidebarProvider, SidebarTrigger } from '@tzj/ui';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ScreenWatermark } from './ScreenWatermark';
import { AppSidebar } from './Sidebar';

const NAV_QUERY_KEY = 'nav';

/**
 * 后台壳层：shadcn Sidebar + 固定视口 + 内部 ScrollArea 滚动。
 * 侧边栏收起/展开状态经 URL 参数 ?nav=collapsed 持久化（刷新/分享可恢复），
 * URL 无参数时回退到服务端读取的 cookie（跨页导航后刷新的场景）。
 */
export function DashboardShell({
  children,
  username,
  roleLabel,
  defaultOpen = true,
  watermark,
}: {
  children: React.ReactNode;
  username: string;
  roleLabel: string;
  /** 服务端从 cookie 读取的默认展开状态（跨页导航后 URL 无参数时的回退） */
  defaultOpen?: boolean;
  /** 后台防截图水印配置（enabled 为真时叠加全局明水印） */
  watermark?: ScreenWatermarkConfig;
}) {
  const searchParams = useSearchParams();
  // URL 参数优先（刷新/显式状态）；无参数 → cookie 默认值
  const [open, setOpen] = useState(() => {
    const nav = searchParams.get(NAV_QUERY_KEY);
    if (nav === 'collapsed') return false;
    if (nav === 'expanded') return true;
    return defaultOpen;
  });

  // 切换时同步 URL（history.replaceState 仅更新地址栏、不触发 RSC 请求，
  // 避免经 proxy 误判未登录；cookie 由 SidebarProvider 内部同步写入）。
  const handleOpenChange = useCallback((value: boolean) => {
    setOpen(value);
    if (typeof window !== 'undefined') {
      const next = new URLSearchParams(window.location.search);
      if (value) next.delete(NAV_QUERY_KEY);
      else next.set(NAV_QUERY_KEY, 'collapsed');
      window.history.replaceState(null, '', `?${next.toString()}`);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('dashboard-shell');
    return () => document.documentElement.classList.remove('dashboard-shell');
  }, []);

  return (
    <SidebarProvider open={open} onOpenChange={handleOpenChange} className="h-svh overflow-hidden">
      {watermark?.enabled ? (
        <ScreenWatermark username={username} text={watermark.text} opacity={watermark.opacity} />
      ) : null}
      <AppSidebar username={username} roleLabel={roleLabel} />
      <SidebarInset className="flex min-h-0 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <SidebarTrigger className="-ml-1" />
          <p className="flex-1 text-sm text-muted-foreground">河南拓之迹 · 企业内容管理系统</p>
        </header>
        {/* 冷灰画布（canvas）：比 surface 深一档、肉眼可辨，白卡浮起的同时
            也作为深色侧栏→浅色内容的明度过渡台阶 */}
        <ScrollArea className="min-h-0 flex-1 bg-canvas">
          {/* 超宽屏收敛内容宽度，避免表格/卡片无限拉伸导致扫读动线过长；
              上限取 1920px，主流 2K/27寸大屏仍可铺满，仅约束更宽的带鱼屏 */}
          <main className="mx-auto w-full max-w-[1920px] px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </ScrollArea>
      </SidebarInset>
    </SidebarProvider>
  );
}
