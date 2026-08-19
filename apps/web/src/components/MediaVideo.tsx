import { resolveMediaUrl } from '@/lib/media-url';

type MediaVideoProps = React.ComponentPropsWithoutRef<'video'> & {
  /** 窄屏（<768px）低码率版本；提供时以 <source media> 切换，移动端少下载一大半流量。 */
  mobileSrc?: string;
};

/** 视频资源 — 将 /media/* 解析为 MinIO URL 后播放。 */
export function MediaVideo({ src, poster, mobileSrc, ...props }: MediaVideoProps) {
  const resolvedSrc = typeof src === 'string' ? resolveMediaUrl(src) : src;
  const resolvedPoster = typeof poster === 'string' ? resolveMediaUrl(poster) : poster;
  if (mobileSrc && typeof src === 'string') {
    // 多源模式下 src 须改由 <source> 提供（首个匹配项生效）
    return (
      <video {...props} poster={resolvedPoster}>
        <source media="(max-width: 767px)" src={resolveMediaUrl(mobileSrc)} type="video/mp4" />
        <source src={resolveMediaUrl(src)} type="video/mp4" />
      </video>
    );
  }
  return <video {...props} src={resolvedSrc} poster={resolvedPoster} />;
}
