/** 对象存储公开访问域名（与 API S3_PUBLIC_DOMAIN 一致）。 */
export function getS3PublicDomain(): string {
  return (
    process.env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN ??
    process.env.S3_PUBLIC_DOMAIN ??
    'http://localhost:9000/tzj-uploads-dev'
  );
}

const OBJECT_PREFIX = 'content';

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

/** 去掉误重复的 bucket 路径段。 */
function collapseRepeatedBucketPrefix(key: string): string {
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

function toMinioUrl(key: string): string {
  return `${getPublicDomainBase()}/${collapseRepeatedBucketPrefix(key)}`;
}

/** 将 MediaPicker URL 规范为 MinIO 对象 key（保存到 CMS 时使用） */
export function normalizeSocialQrForSave(url?: string | null): string {
  if (!url?.trim()) return '';
  const src = url.trim();

  // Already a relative key
  if (!/^https?:\/\//i.test(src) && !src.startsWith('/') && src.includes('/')) {
    return collapseRepeatedBucketPrefix(src) || src;
  }

  const base = getPublicDomainBase();
  let s = src;

  if (s.startsWith(`${base}/`)) {
    s = s.slice(base.length + 1);
  } else if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      s = u.pathname.replace(/^\/+/, '');
      // Strip any bucket name (first path segment) to get the object key
      const slashIdx = s.indexOf('/');
      if (slashIdx > 0) s = s.slice(slashIdx + 1);
    } catch {
      return src;
    }
  }

  s = collapseRepeatedBucketPrefix(s.replace(/^\/+/, ''));
  if (s && s.includes('/')) return s;

  // /wechat.jpg 等站点静态资源 → content/wechat.jpg
  if (/^(wechat|douyin)\.(jpg|jpeg|png|webp|svg)$/i.test(s)) {
    return `${OBJECT_PREFIX}/${s}`;
  }

  return src;
}

/** 将 CMS 路径解析为 MinIO 绝对 URL（与 C 端 resolveMediaUrl 对齐） */
export function resolveMediaUrl(url?: string | null): string {
  if (!url?.trim()) return '';
  const src = url.trim();
  if (/^https?:\/\//i.test(src)) {
    const base = getPublicDomainBase();

    if (src === base || src.startsWith(`${base}/`)) {
      const raw = src === base ? '' : src.slice(base.length + 1);
      const key = collapseRepeatedBucketPrefix(raw);
      return key ? toMinioUrl(key) : src;
    }

    try {
      const u = new URL(src);
      const path = u.pathname.replace(/^\/+/, '');
      if (!path) return src;

      const hostname = u.hostname.toLowerCase();

      try {
        const pub = new URL(base);
        if (hostname === pub.hostname.toLowerCase()) {
          const pubPath = pub.pathname.replace(/^\/+|\/+$/g, '');
          let key = path;
          if (pubPath && (key === pubPath || key.startsWith(`${pubPath}/`))) {
            key = key === pubPath ? '' : key.slice(pubPath.length + 1);
          }
          key = collapseRepeatedBucketPrefix(key);
          return key ? toMinioUrl(key) : src;
        }
      } catch {
        /* ignore */
      }

      // 历史自定义 CDN：.jiawen.live — 保留原 URL（域名直指对象）
      if (hostname === 'jiawen.live' || hostname.endsWith('.jiawen.live')) {
        return src;
      }

      // 其它含 static 的历史 CDN（当前公开域主机已在上面处理）
      if (hostname.includes('static')) {
        return src;
      }

      // MinIO/OSS 原生域名：剥离 bucket 后拼到当前环境
      const slashIdx = path.indexOf('/');
      if (slashIdx > 0) {
        const key = collapseRepeatedBucketPrefix(path.slice(slashIdx + 1));
        if (key) return toMinioUrl(key);
      }
    } catch {
      return src;
    }
    return src;
  }

  if (src.startsWith('/media/')) {
    return toMinioUrl(`${OBJECT_PREFIX}/${src.slice('/media/'.length)}`);
  }

  // Any relative path containing "/" is treated as an S3 object key
  if (!src.startsWith('/') && !src.startsWith('//') && src.includes('/')) {
    return toMinioUrl(src);
  }

  if (src.startsWith('/') && !src.startsWith('//')) {
    const filename = src.slice(1);
    if (filename && !filename.includes('/')) {
      return toMinioUrl(`${OBJECT_PREFIX}/${filename}`);
    }
  }

  return src;
}
