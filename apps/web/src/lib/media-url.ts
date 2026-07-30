import { env } from './env';

/** 对象存储公开访问域名（与 API S3_PUBLIC_DOMAIN 一致）。 */
export function getS3PublicDomain(): string {
  return env.s3PublicDomain;
}

/** MinIO 中站点静态资源的 key 前缀（与 sync-content-media 上传路径一致）。 */
export const STATIC_MEDIA_OBJECT_PREFIX = 'content';

/** 已知 bucket 名：用于折叠历史误拼的重复前缀（与对象真实 key 目录不冲突）。 */
const KNOWN_BUCKET_NAMES = ['tzj-uploads-prod', 'tzj-uploads-dev', 'tzj-uploads'] as const;

function getPublicDomainBase(): string {
  return getS3PublicDomain().replace(/\/$/, '');
}

function getConfiguredBucket(): string | null {
  try {
    const u = new URL(getPublicDomainBase());
    const segments = u.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    return segments.length > 0 ? segments[segments.length - 1]! : null;
  } catch {
    return null;
  }
}

/** 去掉误重复的 bucket 路径段（如 tzj-uploads-prod/tzj-uploads-prod/content/…）。 */
export function collapseRepeatedBucketPrefix(key: string): string {
  const prefixes = new Set<string>(KNOWN_BUCKET_NAMES);
  const configured = getConfiguredBucket();
  if (configured) prefixes.add(configured);

  let k = key.replace(/^\/+/, '');
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of prefixes) {
      if (k === p) return '';
      if (k.startsWith(`${p}/`)) {
        k = k.slice(p.length + 1);
        changed = true;
        break;
      }
    }
  }
  return k;
}

/** 从 MediaPicker / 历史数据中的绝对 URL 提取对象 key
 *  兼容不同环境的 bucket 名（tzj-uploads-dev / tzj-static 等）
 *  支持所有路径前缀（uploads/、content/、cases/、images/ 等） */
export function extractMediaObjectKey(url?: string | null): string | undefined {
  if (!url?.trim()) return undefined;
  const src = url.trim();
  // Relative key — any path-like string without protocol
  if (!/^https?:\/\//i.test(src) && !src.startsWith('/') && src.includes('/')) {
    const key = collapseRepeatedBucketPrefix(src);
    return key.includes('/') ? key : undefined;
  }

  if (/^https?:\/\//i.test(src)) {
    const base = getPublicDomainBase();

    // 当前环境公开域名前缀优先剥离（含误重复的 bucket 段）
    if (src === base || src.startsWith(`${base}/`)) {
      const raw = src === base ? '' : src.slice(base.length + 1);
      const key = collapseRepeatedBucketPrefix(raw);
      return key || undefined;
    }

    try {
      const u = new URL(src);
      const path = u.pathname.replace(/^\/+/, '');
      if (!path) return undefined;

      const hostname = u.hostname.toLowerCase();

      // 与当前公开域同主机：按公开域 pathname（通常是 bucket）剥离，再折叠重复段
      try {
        const pub = new URL(base);
        if (hostname === pub.hostname.toLowerCase()) {
          const pubPath = pub.pathname.replace(/^\/+|\/+$/g, '');
          let key = path;
          if (pubPath && (key === pubPath || key.startsWith(`${pubPath}/`))) {
            key = key === pubPath ? '' : key.slice(pubPath.length + 1);
          }
          key = collapseRepeatedBucketPrefix(key);
          return key || undefined;
        }
      } catch {
        /* ignore malformed public domain */
      }

      // 历史自定义 CDN（jiawen.live）：域名直指 bucket，path 即 key
      if (hostname === 'jiawen.live' || hostname.endsWith('.jiawen.live')) {
        const key = collapseRepeatedBucketPrefix(path);
        return key || undefined;
      }

      // 其它含 static 的历史 CDN（排除上面已处理的当前公开域主机）
      if (hostname.includes('static')) {
        const key = collapseRepeatedBucketPrefix(path);
        return key || undefined;
      }

      // MinIO/OSS 原生域名（path-style）：剥第一段 bucket
      const slashIdx = path.indexOf('/');
      if (slashIdx > 0) {
        const key = collapseRepeatedBucketPrefix(path.slice(slashIdx + 1));
        return key || undefined;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function toMinioUrl(key: string): string {
  return `${getPublicDomainBase()}/${collapseRepeatedBucketPrefix(key)}`;
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
