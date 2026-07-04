"use client";

import { useEffect, useRef, useState } from "react";
import { resolveMediaUrl } from "@/lib/media-url";

type LazyMediaVideoProps = React.ComponentPropsWithoutRef<"video"> & {
  src: string;
  /** 进入视口后再加载并播放（用于首屏以下的背景视频）。 */
  lazy?: boolean;
};

/**
 * 视频组件：lazy 模式下用 Intersection Observer 延迟拉流，减轻首屏带宽。
 */
export function LazyMediaVideo({
  src,
  poster,
  lazy = false,
  autoPlay,
  preload,
  ...props
}: LazyMediaVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(!lazy);

  const resolvedSrc = typeof src === "string" ? resolveMediaUrl(src) : src;
  const resolvedPoster =
    typeof poster === "string" ? resolveMediaUrl(poster) : poster;

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
      { rootMargin: "240px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [lazy, inView]);

  return (
    <video
      ref={ref}
      {...props}
      src={inView ? resolvedSrc : undefined}
      poster={resolvedPoster}
      preload={inView ? (preload ?? "metadata") : "none"}
      autoPlay={inView ? autoPlay : false}
    />
  );
}
