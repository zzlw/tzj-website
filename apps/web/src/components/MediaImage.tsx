'use client';

import type { ImageProps } from 'next/image';
import NextImage from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { resolveMediaUrl } from '@/lib/media-url';
import { ossImageLoader } from '@/lib/oss-image-loader';
import { cn } from '@/lib/utils';

/**
 * 站点媒体图 — 解析为 MinIO URL，使用 OSS 图片处理（生产环境自动缩放 + WebP 压缩）。
 * 本地开发走 MinIO 原图；生产环境由阿里云 OSS 实时处理。
 * 非 preload 时默认 lazy，减少首屏外图片带宽。
 *
 * 所有图片（含 lazy）统一走 ossImageLoader，确保生产环境都附加
 * x-oss-process（resize + webp + 分级质量）；否则 lazy 图会以原图直出，
 * 2~3MB 的 PNG/JPG 会原样发给浏览器。unoptimized 仅允许调用方显式开启。
 *
 * 加载体验：lazy 图默认启用 fade-in 过渡（onLoad 后 400ms opacity + blur 渐入），
 * 期间由容器背景 shimmer 骨架占位；eager/preload 图自动禁用，避免人为延迟 LCP。
 */

type MediaImageProps = ImageProps & {
  /** 是否启用加载过渡动画。默认仅对 lazy 图开启；eager/preload 图自动关闭。 */
  fadeOnLoad?: boolean;
};

export function MediaImage({
  preload,
  loading,
  unoptimized,
  fadeOnLoad,
  className,
  onLoad,
  ...props
}: MediaImageProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  // idle=SSR/未水合：不隐藏图片（旧内核 JS 失败时内容仍可见）；
  // hidden=水合后尚未加载完：先 opacity-0 占位，加载完成后淡入；
  // loaded=已加载完成（若经历过 hidden 则执行 rb-img-fadein 淡入）。
  const [imgState, setImgState] = useState<'idle' | 'hidden' | 'loaded'>('idle');
  const [wasHidden, setWasHidden] = useState(false);
  const rawSrc = typeof props.src === 'string' ? props.src : '';
  const src = rawSrc ? resolveMediaUrl(rawSrc) : rawSrc;
  const resolvedLoading = loading ?? (preload ? 'eager' : 'lazy');
  // preload 会强制 eager 加载（Next.js 内部优先），矛盾组合时以 preload 为准
  const isLazy = resolvedLoading === 'lazy' && !preload;

  // eager/preload 图是 LCP 候选，不应人为 opacity-0 延迟显示；
  // 仅 lazy 图默认开启 fade-in，调用方也可显式覆盖。
  const shouldFade = fadeOnLoad ?? isLazy;

  // 水合后再决定是否隐藏：图片若已在 JS 挂载前加载完（如缓存命中），直接显示不淡入；
  // 未加载完则先隐藏、等 onLoad 后淡入。JS 完全失败时保持 SSR 可见，避免「图挂了但透明」。
  useEffect(() => {
    if (imgRef.current?.complete) {
      setImgState('loaded');
    } else {
      setImgState('hidden');
      setWasHidden(true);
    }
  }, []);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setImgState('loaded');
    onLoad?.(e); // 转发给调用方，不吞掉原始回调
  };

  // 图片加载失败时也需移除 opacity-0，否则 shimmer 永不停止、图片永远不可见
  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setImgState('loaded');
    props.onError?.(e);
  };

  const hide = shouldFade && imgState === 'hidden';
  const fade = shouldFade && imgState === 'loaded' && wasHidden;

  return (
    <NextImage
      {...props}
      ref={imgRef}
      src={src || props.src}
      preload={preload}
      loading={resolvedLoading}
      unoptimized={unoptimized}
      loader={ossImageLoader}
      className={cn(className, hide && 'opacity-0', fade && 'rb-img-fadein')}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
}
