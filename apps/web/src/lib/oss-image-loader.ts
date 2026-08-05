import type { ImageLoaderProps } from 'next/image';

/**
 * OSS 图片处理 Loader
 *
 * 质量分级策略（通过 next/image 的 quality prop 传入）：
 * - quality={90} — Hero 背景 / 全屏大图（视觉优先，仅轻微压缩）
 * - quality={80} — 中等详情图
 * - 未显式指定时按请求宽度自动分级：
 *   ≤640 → 70（缩略图/卡片）、≤1200 → 75（列表/中等图）、>1200 → 82（大图）
 *
 * 生产环境（非 localhost）追加 ?x-oss-process 参数；
 * 本地开发（MinIO）直接返回原 URL。
 */
const QUALITY_BY_WIDTH: Array<{ max: number; quality: number }> = [
  { max: 640, quality: 70 },
  { max: 1200, quality: 75 },
  { max: Number.POSITIVE_INFINITY, quality: 82 },
];

function defaultQualityForWidth(width?: number): number {
  if (!width || width <= 0) return 75;
  for (const tier of QUALITY_BY_WIDTH) {
    if (width <= tier.max) return tier.quality;
  }
  return 82;
}

export function ossImageLoader({ src, width, quality }: ImageLoaderProps): string {
  try {
    const url = new URL(src);

    // 本地开发 MinIO — 不做 OSS 处理，但附加 width 以满足 next/image 检查
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      if (width) url.searchParams.set('w', String(width));
      return url.toString();
    }

    // SVG / GIF 不适合 OSS 缩放处理
    if (/\.(svg|gif)(\?|$)/i.test(url.pathname)) {
      return src;
    }

    const q = quality ?? defaultQualityForWidth(width);
    url.searchParams.set('x-oss-process', `image/resize,w_${width}/quality,q_${q}/format,webp`);
    return url.toString();
  } catch {
    return src;
  }
}
