'use client';

import { isBaiduAppUserAgent } from '@tzj/device';
import { type ComponentProps, useEffect, useState } from 'react';
import { LazyMediaVideo } from '@/components/LazyMediaVideo';

type BaiduSafeVideoLayerProps = ComponentProps<typeof LazyMediaVideo>;

/**
 * 背景视频层 — 服务端不输出 <video>，水合后空闲再挂载；命中百度 App 则始终不挂载。
 *
 * 百度 App 的「视频嗅探」只作用于 DOM 中已存在的 <video>，从不挂载即可规避，
 * 与原先的服务端 UA 分支等效。判定移到客户端后，页面 HTML 不再随 UA 变化，
 * 网关才能按 $uri 让所有访客共享一份缓存。
 *
 * 封面由调用方单独以 <MediaImage> 渲染（走 OSS 缩放与 WebP），
 * 因此视频延后或缺席都不影响首屏与 LCP。
 */
export function BaiduSafeVideoLayer(props: BaiduSafeVideoLayerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isBaiduAppUserAgent(navigator.userAgent)) return;

    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => setMounted(true), { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }

    const id = window.setTimeout(() => setMounted(true), 1500);
    return () => window.clearTimeout(id);
  }, []);

  return mounted ? <LazyMediaVideo {...props} /> : null;
}
