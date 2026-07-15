'use client';

import type { ImageProps } from 'next/image';
import NextImage from 'next/image';
import { resolveMediaUrl } from '@/lib/media-url';
import { ossImageLoader } from '@/lib/oss-image-loader';

/**
 * 站点媒体图 — 解析为 MinIO URL，使用 OSS 图片处理（生产环境自动缩放 + WebP 压缩）。
 * 本地开发走 MinIO 原图；生产环境由阿里云 OSS 实时处理。
 * 非 preload 时默认 lazy，减少首屏外图片带宽。
 *
 * lazy 图片自动启用 unoptimized，跳过 Next.js 内部 allImgs 性能追踪，
 * 避免同一张图片在不同组件中因 loading 策略不同（eager vs lazy）导致
 * Map key 覆盖而误报 LCP 警告。生产环境的 OSS 图片处理不受影响。
 */
export function MediaImage({ preload, loading, unoptimized, ...props }: ImageProps) {
  const rawSrc = typeof props.src === 'string' ? props.src : '';
  const src = rawSrc ? resolveMediaUrl(rawSrc) : rawSrc;
  const resolvedLoading = loading ?? (preload ? 'eager' : 'lazy');
  const isLazy = resolvedLoading === 'lazy';

  return (
    <NextImage
      {...props}
      src={src || props.src}
      preload={preload}
      loading={resolvedLoading}
      unoptimized={unoptimized ?? isLazy}
      loader={ossImageLoader}
    />
  );
}
