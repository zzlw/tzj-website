/**
 * 媒体预览 URL：以素材更新时间作为缓存破坏参数。
 * 加水印/去水印/替换站点资源后 URL 不变，浏览器会沿用旧缓存；
 * 追加 `?rev={updatedAt 毫秒}` 使预览立即刷新到最新文件。
 * 仅用于 img/video/audio 预览 src；复制链接/新标签页/插入内容应使用原始 url。
 */
export function mediaPreviewUrl(url: string, updatedAt?: string | null): string {
  if (!url) return url;
  if (!updatedAt) return url;
  const rev = Date.parse(updatedAt);
  if (Number.isNaN(rev)) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}rev=${rev}`;
}
