/** 对象存储公开访问域名（与 API S3_PUBLIC_DOMAIN 一致）。 */
export function getS3PublicDomain(): string {
  return (
    process.env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN ??
    process.env.S3_PUBLIC_DOMAIN ??
    "http://localhost:9000/tzj-uploads-dev"
  );
}

const OBJECT_PREFIX = "content";

function toMinioUrl(key: string): string {
  return `${getS3PublicDomain().replace(/\/$/, "")}/${key.replace(/^\/+/, "")}`;
}

/** 将 MediaPicker URL 规范为 MinIO 对象 key（保存到 CMS 时使用） */
export function normalizeSocialQrForSave(url?: string | null): string {
  if (!url?.trim()) return "";
  const src = url.trim();

  // Already a relative key
  if (!/^https?:\/\//i.test(src) && !src.startsWith("/") && src.includes("/")) return src;

  const base = getS3PublicDomain().replace(/\/$/, "");
  let s = src;

  if (s.startsWith(`${base}/`)) {
    s = s.slice(base.length + 1);
  } else if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      s = u.pathname.replace(/^\/+/, "");
      // Strip any bucket name (first path segment) to get the object key
      const slashIdx = s.indexOf("/");
      if (slashIdx > 0) s = s.slice(slashIdx + 1);
    } catch {
      return src;
    }
  }

  s = s.replace(/^\/+/, "");
  if (s && s.includes("/")) return s;

  // /wechat.jpg 等站点静态资源 → content/wechat.jpg
  if (/^(wechat|douyin)\.(jpg|jpeg|png|webp|svg)$/i.test(s)) {
    return `${OBJECT_PREFIX}/${s}`;
  }

  return src;
}

/** 将 CMS 路径解析为 MinIO 绝对 URL（与 C 端 resolveMediaUrl 对齐） */
export function resolveMediaUrl(url?: string | null): string {
  if (!url?.trim()) return "";
  const src = url.trim();
  if (/^https?:\/\//i.test(src)) {
    try {
      const u = new URL(src);
      const path = u.pathname.replace(/^\/+/, "");
      if (!path) return src;
      
      // 判断是否为自定义 CDN 域名（如 tzj-static.jiawen.live）
      // 这类域名已直接指向 bucket，URL 中不包含 bucket 名，path 就是完整的 object key
      const hostname = u.hostname.toLowerCase();
      const isCustomCdnDomain = hostname.includes(".jiawen.live") || hostname.includes("static");
      
      if (isCustomCdnDomain) {
        // 自定义 CDN：直接使用原 URL，无需重写
        return src;
      }
      
      // MinIO/OSS 原生域名（如 oss-cn-beijing.aliyuncs.com）：需要剥离 bucket 名并重新拼接当前环境域名
      // Strip the first path segment (bucket name) to get the object key
      const slashIdx = path.indexOf("/");
      if (slashIdx > 0) {
        const key = path.slice(slashIdx + 1);
        if (key) return toMinioUrl(key);
      }
    } catch {
      return src;
    }
    return src;
  }

  if (src.startsWith("/media/")) {
    return toMinioUrl(`${OBJECT_PREFIX}/${src.slice("/media/".length)}`);
  }

  // Any relative path containing "/" is treated as an S3 object key
  if (!src.startsWith("/") && !src.startsWith("//") && src.includes("/")) {
    return toMinioUrl(src);
  }

  if (src.startsWith("/") && !src.startsWith("//")) {
    const filename = src.slice(1);
    if (filename && !filename.includes("/")) {
      return toMinioUrl(`${OBJECT_PREFIX}/${filename}`);
    }
  }

  return src;
}
