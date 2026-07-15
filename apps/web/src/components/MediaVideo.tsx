import { resolveMediaUrl } from '@/lib/media-url';

type MediaVideoProps = React.ComponentPropsWithoutRef<'video'>;

/** 视频资源 — 将 /media/* 解析为 MinIO URL 后播放。 */
export function MediaVideo({ src, poster, ...props }: MediaVideoProps) {
  const resolvedSrc = typeof src === 'string' ? resolveMediaUrl(src) : src;
  const resolvedPoster = typeof poster === 'string' ? resolveMediaUrl(poster) : poster;
  return <video {...props} src={resolvedSrc} poster={resolvedPoster} />;
}
