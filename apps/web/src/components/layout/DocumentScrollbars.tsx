"use client";

import { useEffect } from "react";
import { OverlayScrollbars } from "overlayscrollbars";

/** 全站文档滚动：OverlayScrollbars overlay 滚动条，不占用布局宽度。 */
export function DocumentScrollbars() {
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const instance = OverlayScrollbars(document.body, {
      scrollbars: {
        theme: "os-theme-tzj",
        autoHide: reducedMotion ? "never" : "scroll",
        autoHideDelay: 800,
        autoHideSuspend: true,
      },
    });

    return () => {
      instance.destroy();
    };
  }, []);

  return null;
}
