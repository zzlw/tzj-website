import type { ImageLoaderProps } from "next/image";

/**
 * OSS 图片处理 Loader
 *
 * 质量分级策略（通过 next/image 的 quality prop 传入）：
 * - quality={90} — Hero 背景 / 全屏大图（视觉优先，仅轻微压缩）
 * - quality={70} — 卡片缩略图 / 列表配图（体积优先）
 * - 默认 75     — 未指定时的通用值
 *
 * 生产环境（非 localhost）追加 ?x-oss-process 参数；
 * 本地开发（MinIO）直接返回原 URL。
 */
export function ossImageLoader({ src, width, quality }: ImageLoaderProps): string {
  try {
    const url = new URL(src);

    // 本地开发 MinIO — 不做 OSS 处理
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return src;
    }

    // SVG / GIF 不适合 OSS 缩放处理
    if (/\.(svg|gif)(\?|$)/i.test(url.pathname)) {
      return src;
    }

    const q = quality ?? 75;
    url.searchParams.set(
      "x-oss-process",
      `image/resize,w_${width}/quality,q_${q}/format,webp`,
    );
    return url.toString();
  } catch {
    return src;
  }
}
