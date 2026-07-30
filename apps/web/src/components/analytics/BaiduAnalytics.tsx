'use client';

import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { useEffect, useRef } from 'react';

/**
 * 百度统计（hm.js）接入 — 与自建埋点并行、互不依赖。
 *
 * - 直接以 `src` 加载 hm.js（`_hmt` 由脚本自身初始化），刻意避开内联 `dangerouslySetInnerHTML`
 *   （AGENTS.md 宪法级禁令）；afterInteractive 不阻塞首屏。
 * - hm.js 加载时会自动上报首屏 PV；官网是 SPA，故对后续客户端路由切换手动向
 *   `_hmt` 补报 `_trackPageview`，否则百度只统计到落地页一跳。
 * - `hmId` 由 layout SSR 从站点设置下发（后台配置优先、NEXT_PUBLIC_BAIDU_HM_ID 兜底）；
 *   留空时整体不渲染（本地/预览默认不接入）。
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

    const hmt = (window as unknown as { _hmt?: unknown[][] })._hmt;
    hmt?.push(['_trackPageview', pathname]);
  }, [hmId, pathname]);

  if (!hmId) return null;

  return (
    <Script id="baidu-hm" src={`https://hm.baidu.com/hm.js?${hmId}`} strategy="afterInteractive" />
  );
}
