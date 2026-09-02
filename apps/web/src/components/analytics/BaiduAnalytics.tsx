'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * 百度统计（hm.js）SPA 路由补报 — 与自建埋点并行、互不依赖。
 *
 * hm.js 本体由 layout 的 `<head>` 以原生 `async <script>` 直接注入，不再走
 * `next/script`：推广「抵达率」按上报成功计，afterInteractive 要等主包 hydration
 * 完成，慢网下访客常在上报前就已离开，点击被记为未抵达。
 *
 * 官网是 SPA，hm.js 只自动上报首屏 PV，故对后续客户端路由切换手动补报
 * `_trackPageview`。`_hmt` 队列在脚本就位前先自建，避免脚本尚未加载完成时
 * 发生的路由切换丢失 PV（hm.js 加载后会消费既有队列）。
 */
export function BaiduAnalytics({ hmId }: { hmId?: string }) {
  const pathname = usePathname();
  // 初始为 null：hm.js 已自动报首屏 PV，故跳过挂载首帧、只补报后续跳转，避免首页被重复计数。
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!hmId || !pathname) return;
    if (lastPath.current === null) {
      lastPath.current = pathname;
      return;
    }
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;

    const w = window as unknown as { _hmt?: unknown[][] };
    w._hmt = w._hmt ?? [];
    w._hmt.push(['_trackPageview', pathname]);
  }, [hmId, pathname]);

  return null;
}
