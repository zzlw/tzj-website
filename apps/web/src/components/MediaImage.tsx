import type { ImageProps } from "next/image";
import NextImage from "next/image";
import { resolveMediaUrl } from "@/lib/media-url";

/**
 * 站点媒体图 — 解析为 MinIO URL，跳过 next/image 优化器。
 * 非 priority 时默认 lazy，减少首屏外图片带宽。
 */
export function MediaImage({ priority, loading, ...props }: ImageProps) {
  const rawSrc = typeof props.src === "string" ? props.src : "";
  const src = rawSrc ? resolveMediaUrl(rawSrc) : rawSrc;
  const resolvedLoading = loading ?? (priority ? undefined : "lazy");

  return (
    <NextImage
      {...props}
      src={src || props.src}
      priority={priority}
      loading={resolvedLoading}
      unoptimized
    />
  );
}
