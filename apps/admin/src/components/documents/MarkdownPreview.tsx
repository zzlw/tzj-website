"use client";

import { useEffect, useRef } from "react";
import { cn } from "@tzj/ui";

function vditorCdn(): string {
  // Vditor 官方 CDN（生产环境）
  // 注意：不要包含 /dist，Vditor 内部会自动追加 /dist/js/lute/lute.min.js
  if (process.env.NODE_ENV === "production") {
    return "https://unpkg.com/vditor@3.11.2";
  }
  // 开发环境：从 public/vditor-assets 加载
  return "/vditor-assets";
}

export function MarkdownPreview({
  markdown,
  className,
  variant = "default",
}: {
  markdown: string;
  className?: string;
  /** article：阅读页正文，无边框、更大字号 */
  variant?: "default" | "article";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const el = ref.current;
    if (!el) return;

    void (async () => {
      const [{ default: Vditor }] = await Promise.all([
        import("vditor"),
        import("vditor/dist/index.css"),
      ]);
      if (cancelled || !ref.current) return;

      ref.current.innerHTML = "";
      Vditor.preview(ref.current, markdown || "", {
        cdn: vditorCdn(),
        mode: "light",
        theme: { current: "light" },
        hljs: { lineNumber: true },
      });
    })();

    return () => {
      cancelled = true;
      if (ref.current) ref.current.innerHTML = "";
    };
  }, [markdown]);

  return (
    <div
      ref={ref}
      className={cn(
        "vditor-reset markdown-preview",
        variant === "article"
          ? "markdown-preview-article min-h-[8rem] text-[15px] leading-relaxed"
          : "min-h-[120px] rounded-md border border-border/80 bg-background p-4 text-sm",
        className,
      )}
    />
  );
}
