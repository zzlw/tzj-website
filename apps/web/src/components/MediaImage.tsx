"use client";

import type { ImageProps } from "next/image";
import NextImage from "next/image";
import { resolveMediaUrl } from "@/lib/media-url";
import { ossImageLoader } from "@/lib/oss-image-loader";

/**
 * 站点媒体图 — 解析为 MinIO URL，使用 OSS 图片处理（生产环境自动缩放 + WebP 压缩）。
 * 本地开发走 MinIO 原图；生产环境由阿里云 OSS 实时处理。
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
      loader={ossImageLoader}
    />
  );
}
