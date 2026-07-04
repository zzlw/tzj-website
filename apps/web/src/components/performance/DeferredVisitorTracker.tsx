"use client";

import { useEffect, useState } from "react";
import { VisitorTracker } from "@/components/analytics/VisitorTracker";

/**
 * 分析上报延后到浏览器空闲时段，避免与 LCP/INP 争抢主线程。
 * 2026 常见做法：idle 调度 + 低优先级，而非阻塞首屏 hydration。
 */
export function DeferredVisitorTracker() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const activate = () => setReady(true);

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(activate, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }

    const id = window.setTimeout(activate, 1500);
    return () => window.clearTimeout(id);
  }, []);

  if (!ready) return null;
  return <VisitorTracker />;
}
