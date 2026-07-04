"use client";

import { useEffect } from "react";
import { ScrollArea, SidebarInset, SidebarProvider, SidebarTrigger } from "@tzj/ui";
import { AppSidebar } from "./Sidebar";

/**
 * 后台壳层：shadcn Sidebar + 固定视口 + 内部 ScrollArea 滚动。
 */
export function DashboardShell({
  children,
  username,
  roleLabel,
}: {
  children: React.ReactNode;
  username: string;
  roleLabel: string;
}) {
  useEffect(() => {
    document.documentElement.classList.add("dashboard-shell");
    return () => document.documentElement.classList.remove("dashboard-shell");
  }, []);

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar username={username} roleLabel={roleLabel} />
      <SidebarInset className="flex min-h-0 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <SidebarTrigger className="-ml-1" />
          <p className="flex-1 text-sm text-muted-foreground">
            河南拓之迹 · 企业内容管理系统
          </p>
        </header>
        <ScrollArea className="min-h-0 flex-1">
          <main className="w-full px-4 py-5 sm:px-6 lg:px-8">{children}</main>
        </ScrollArea>
      </SidebarInset>
    </SidebarProvider>
  );
}
