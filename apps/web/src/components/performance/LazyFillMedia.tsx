'use client';

import { type ComponentProps, useEffect, useRef, useState } from 'react';
import { MediaImage } from '@/components/MediaImage';
import { observeOnceInView } from '@/lib/in-view';

type LazyFillMediaProps = ComponentProps<typeof MediaImage> & {
  frameClassName?: string;
  rootMargin?: string;
};

/**
 * 折页 fill 图：服务端只下发 src 等原始字段，进入视口再挂 MediaImage。
 * 不要把 <MediaImage> 当 children 传入，否则 RSC 仍会序列化整棵图片树。
 */
export function LazyFillMedia({
  frameClassName = 'absolute inset-0',
  rootMargin = '200px',
  ...imageProps
}: LazyFillMediaProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || show) return;
    return observeOnceInView(el, () => setShow(true), rootMargin);
  }, [rootMargin, show]);

  return (
    <div ref={ref} className={frameClassName}>
      {show ? <MediaImage {...imageProps} /> : null}
    </div>
  );
}
