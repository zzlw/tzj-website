/** 对象存储公开访问域名（与 API S3_PUBLIC_DOMAIN 一致）。 */
export function getS3PublicDomain(): string {
  return (
    process.env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN ?? "http://localhost:9000/tzj-uploads-dev"
  );
}

/** MinIO 中站点静态资源的 key 前缀（与 sync-content-media 上传路径一致）。 */
export const STATIC_MEDIA_OBJECT_PREFIX = "content";

/** 从 MediaPicker / 历史数据中的绝对 URL 提取对象 key（uploads/…、content/…）
 *  兼容不同环境的 bucket 名（tzj-uploads-dev / tzj-static 等） */
export function extractMediaObjectKey(url?: string | null): string | undefined {
  if (!url?.trim()) return undefined;
  const src = url.trim();
  if (/^(uploads|content)\//.test(src)) return src;

  if (/^https?:\/\//i.test(src)) {
    try {
      const u = new URL(src);
      const path = u.pathname.replace(/^\/+/, "");
      if (/^(uploads|content)\//.test(path)) return path;
      // Strip any bucket name (first path segment) to get the object key
      const slashIdx = path.indexOf("/");
      if (slashIdx > 0) {
        const rest = path.slice(slashIdx + 1);
        if (/^(uploads|content)\//.test(rest)) return rest;
      }
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function toMinioUrl(key: string): string {
  return `${getS3PublicDomain().replace(/\/$/, "")}/${key.replace(/^\/+/, "")}`;
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
 * - uploads/…、content/… → MinIO 对象
 * - /media/…、/wechat.jpg 等 public 根路径 → content/…（sync-content-media 同步目标）
 */
export function resolveMediaUrl(url?: string | null): string {
  if (!url?.trim()) return "";
  const src = url.trim();
  if (/^https?:\/\//i.test(src)) return normalizeStorageUrl(src);

  if (src.startsWith("/media/")) {
    return toMinioUrl(`${STATIC_MEDIA_OBJECT_PREFIX}/${src.slice("/media/".length)}`);
  }

  if (/^(uploads|content)\//.test(src)) {
    return toMinioUrl(src);
  }

  // public 根目录：/wechat.jpg → content/wechat.jpg（与 sync-content-media 一致）
  if (src.startsWith("/") && !src.startsWith("//")) {
    const filename = src.slice(1);
    if (filename && !filename.includes("/")) {
      return toMinioUrl(`${STATIC_MEDIA_OBJECT_PREFIX}/${filename}`);
    }
  }

  return src;
}

/** 默认二维码 MinIO key（content/ 前缀，sync-content-media 同步目标） */
export function defaultSocialQrPath(platform: "wechat" | "douyin" | "weibo" | "xiaohongshu"): string {
  if (platform === "wechat") return "content/wechat.jpg";
  if (platform === "douyin") return "content/douyin.jpg";
  return "";
}
