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

/** OSS 图片处理支持的输出格式；AVIF 同参数下比 WebP 小三到四成。 */
type OssImageFormat = 'webp' | 'avif';

function buildOssUrl({ src, width, quality }: ImageLoaderProps, format: OssImageFormat): string {
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
    url.searchParams.set(
      'x-oss-process',
      `image/resize,w_${width}/quality,q_${q}/format,${format}`,
    );
    return url.toString();
  } catch {
    return src;
  }
}

export function ossImageLoader(props: ImageLoaderProps): string {
  return buildOssUrl(props, 'webp');
}

/** 该 src 是否会真正走 OSS 处理（本地 MinIO 与 SVG/GIF 不会）。 */
function isOssProcessable(src: string): boolean {
  try {
    const url = new URL(src);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return false;
    return !/\.(svg|gif)(\?|$)/i.test(url.pathname);
  } catch {
    return false;
  }
}

/** next/image 默认候选宽度（next.config 未覆盖 deviceSizes / imageSizes）。 */
const CANDIDATE_WIDTHS = [
  16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840,
] as const;

/**
 * 生成 AVIF 候选集，供 <picture> 的 <source type="image/avif"> 使用。
 * 浏览器不认 AVIF 时会跳过该 source，回落到 next/image 输出的 WebP <img>，
 * 因此无需做 UA 判定，也不影响 HTML 的可缓存性。
 * 返回 null 表示该图没有 AVIF 候选（本地 MinIO / SVG / GIF）。
 */
export function ossAvifSrcSet(src: string, quality?: number): string | null {
  if (!src || !isOssProcessable(src)) return null;
  return CANDIDATE_WIDTHS.map(
    (width) => `${buildOssUrl({ src, width, quality }, 'avif')} ${width}w`,
  ).join(', ');
}
