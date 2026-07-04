/** 对象存储公开访问域名（与 API S3_PUBLIC_DOMAIN 一致）。 */
export function getS3PublicDomain(): string {
  return (
    process.env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN ?? "http://localhost:9000/tzj-uploads-dev"
  );
}

/** MinIO 中站点静态资源的 key 前缀（与 sync-content-media 上传路径一致）。 */
export const STATIC_MEDIA_OBJECT_PREFIX = "content";

function objectUrl(filename: string): string {
  return `${getS3PublicDomain().replace(/\/$/, "")}/${STATIC_MEDIA_OBJECT_PREFIX}/${filename}`;
}

/** 将 /media/* 或 public 根目录静态文件路径解析为 MinIO 绝对 URL。 */
export function resolveMediaUrl(url?: string | null): string {
  if (!url?.trim()) return "";
  const src = url.trim();
  if (/^https?:\/\//i.test(src)) return src;

  if (src.startsWith("/media/")) {
    return objectUrl(src.slice("/media/".length));
  }

  // public 根目录资源：/og-default.jpg、/favicon.ico 等
  if (src.startsWith("/") && !src.startsWith("//")) {
    const filename = src.slice(1);
    if (filename && !filename.includes("/")) {
      return objectUrl(filename);
    }
  }

  return src;
}
