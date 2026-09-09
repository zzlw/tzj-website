'use client';

import { useEffect, useRef, useState } from 'react';
import { resolveMediaUrl } from '@/lib/media-url';

type LazyMediaVideoProps = React.ComponentPropsWithoutRef<'video'> & {
  src: string;
  /** 窄屏（<768px）低码率版本；提供时以 <source media> 切换，移动端少下载一大半流量。 */
  mobileSrc?: string;
  /** 进入视口后再加载并播放（用于首屏以下的背景视频）。 */
  lazy?: boolean;
};

/**
 * 视频组件：lazy 模式下用 Intersection Observer 延迟拉流，减轻首屏带宽。
 */
export function LazyMediaVideo({
  src,
  poster,
  mobileSrc,
  lazy = false,
  autoPlay,
  preload,
  ...props
}: LazyMediaVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(!lazy);

  const resolvedSrc = typeof src === 'string' ? resolveMediaUrl(src) : src;
  const resolvedPoster = typeof poster === 'string' ? resolveMediaUrl(poster) : poster;

  useEffect(() => {
    if (!lazy || inView) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [lazy, inView]);

  return (
    <video
      ref={ref}
      {...props}
      // 多源模式下 src 须改由 <source> 提供（首个匹配项生效）
      src={mobileSrc ? undefined : inView ? resolvedSrc : undefined}
      poster={resolvedPoster}
      preload={inView ? (preload ?? 'metadata') : 'none'}
      autoPlay={inView ? autoPlay : false}
    >
      {mobileSrc && inView ? (
        <>
          <source media="(max-width: 767px)" src={resolveMediaUrl(mobileSrc)} type="video/mp4" />
          <source src={resolvedSrc} type="video/mp4" />
        </>
      ) : null}
    </video>
  );
}
