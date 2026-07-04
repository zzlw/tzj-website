"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackPageView } from "@/lib/analytics";

/** 官网 SPA 路由切换时上报 PV（first-party，隐私友好）。 */
export function VisitorTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === lastPath.current) return;
    lastPath.current = pathname;

    const title = typeof document !== "undefined" ? document.title : undefined;
    trackPageView({ path: pathname, title });
  }, [pathname]);

  return null;
}
