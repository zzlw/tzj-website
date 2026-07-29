import { env } from './env';

/** 对象存储公开访问域名（与 API S3_PUBLIC_DOMAIN 一致）。 */
export function getS3PublicDomain(): string {
  return env.s3PublicDomain;
}

/** MinIO 中站点静态资源的 key 前缀（与 sync-content-media 上传路径一致）。 */
export const STATIC_MEDIA_OBJECT_PREFIX = 'content';

/** 从 MediaPicker / 历史数据中的绝对 URL 提取对象 key
 *  兼容不同环境的 bucket 名（tzj-uploads-dev / tzj-static 等）
 *  支持所有路径前缀（uploads/、content/、cases/、images/ 等） */
export function extractMediaObjectKey(url?: string | null): string | undefined {
  if (!url?.trim()) return undefined;
  const src = url.trim();
  // Relative key — any path-like string without protocol
  if (!/^https?:\/\//i.test(src) && !src.startsWith('/') && src.includes('/')) {
    return src;
  }

  if (/^https?:\/\//i.test(src)) {
    try {
      const u = new URL(src);
      const path = u.pathname.replace(/^\/+/, '');
      if (!path) return undefined;

      // 判断是否为自定义 CDN 域名（如 tzj-static.jiawen.live）
      // 这类域名已直接指向 bucket，URL 中不包含 bucket 名，path 就是完整的 object key
      const hostname = u.hostname.toLowerCase();
      const isCustomCdnDomain = hostname.includes('.jiawen.live') || hostname.includes('static');

      if (isCustomCdnDomain) {
        // 自定义 CDN：path 即为完整 key（如 content/tower-chino.jpg）
        return path;
      }

      // MinIO/OSS 原生域名（如 oss-cn-beijing.aliyuncs.com）：需要剥离 bucket 名
      // If path has multiple segments, strip the first (bucket name) to get the key
      const slashIdx = path.indexOf('/');
      if (slashIdx > 0) {
        return path.slice(slashIdx + 1);
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function toMinioUrl(key: string): string {
  return `${getS3PublicDomain().replace(/\/$/, '')}/${key.replace(/^\/+/, '')}`;
}

/** 将任意存储 URL 规范为当前环境的 MinIO 公开访问地址 */
export function normalizeStorageUrl(url: string): string {
  const key = extractMediaObjectKey(url);
  if (key) return toMinioUrl(key);
  return url;
}

/** 社媒二维码 — 与 resolveMediaUrl 一致，统一走 MinIO */
export function resolveSocialQrUrl(raw?: string | null): string {
  return resolveMediaUrl(raw);
}

/**
 * 将 CMS 路径解析为 MinIO 绝对 URL。
 * - uploads/…、content/…、cases/…、images/… → MinIO 对象
 * - /media/…、/wechat.jpg 等 public 根路径 → content/…（sync-content-media 同步目标）
 */
export function resolveMediaUrl(url?: string | null): string {
  if (!url?.trim()) return '';
  const src = url.trim();
  if (/^https?:\/\//i.test(src)) return normalizeStorageUrl(src);

  if (src.startsWith('/media/')) {
    return toMinioUrl(`${STATIC_MEDIA_OBJECT_PREFIX}/${src.slice('/media/'.length)}`);
  }

  // Any relative path containing "/" is treated as an S3 object key
  if (!src.startsWith('/') && !src.startsWith('//') && src.includes('/')) {
    return toMinioUrl(src);
  }

  // public 根目录：/wechat.jpg → content/wechat.jpg（与 sync-content-media 一致）
  if (src.startsWith('/') && !src.startsWith('//')) {
    const filename = src.slice(1);
    if (filename && !filename.includes('/')) {
      return toMinioUrl(`${STATIC_MEDIA_OBJECT_PREFIX}/${filename}`);
    }
  }

  return src;
}

/** 默认二维码 MinIO key（content/ 前缀，sync-content-media 同步目标） */
export function defaultSocialQrPath(
  platform: 'wechat' | 'douyin' | 'weibo' | 'xiaohongshu',
): string {
  if (platform === 'wechat') return 'content/wechat.jpg';
  if (platform === 'douyin') return 'content/douyin.jpg';
  return '';
}
