/** 对象存储公开访问域名（与 API S3_PUBLIC_DOMAIN 一致）。 */
function getS3PublicDomain(): string {
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

  if (/^(uploads|content)\//.test(src)) return src;

  const base = getS3PublicDomain().replace(/\/$/, "");
  let s = src;

  if (s.startsWith(`${base}/`)) {
    s = s.slice(base.length + 1);
  } else if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      s = u.pathname.replace(/^\/+/, "");
      const bucket = base.split("/").pop();
      if (bucket && s.startsWith(`${bucket}/`)) {
        s = s.slice(bucket.length + 1);
      }
    } catch {
      return src;
    }
  }

  s = s.replace(/^\/+/, "");
  if (/^(uploads|content)\//.test(s)) return s;

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
    const base = getS3PublicDomain().replace(/\/$/, "");
    if (src.startsWith(`${base}/`)) return src;
    // 历史 localhost 等域名 → 提取 key 重写为当前 MinIO 域名
    let path = src;
    try {
      const u = new URL(src);
      path = u.pathname.replace(/^\/+/, "");
      const bucket = base.split("/").pop();
      if (bucket && path.startsWith(`${bucket}/`)) {
        path = path.slice(bucket.length + 1);
      }
      if (/^(uploads|content)\//.test(path)) return toMinioUrl(path);
    } catch {
      return src;
    }
    return src;
  }

  if (src.startsWith("/media/")) {
    return toMinioUrl(`${OBJECT_PREFIX}/${src.slice("/media/".length)}`);
  }

  if (/^(uploads|content)\//.test(src)) {
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
