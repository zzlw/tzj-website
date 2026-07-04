/** 对象存储公开访问域名（与 API S3_PUBLIC_DOMAIN 一致）。 */
function getS3PublicDomain(): string {
  return (
    process.env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN ??
    process.env.S3_PUBLIC_DOMAIN ??
    "http://localhost:9000/tzj-uploads-dev"
  );
}

const OBJECT_PREFIX = "content";

/** 将相对静态资源路径解析为 MinIO 可访问 URL。 */
export function resolveMediaUrl(url?: string | null): string {
  if (!url?.trim()) return "";
  const src = url.trim();
  if (/^https?:\/\//i.test(src)) return src;

  const base = getS3PublicDomain().replace(/\/$/, "");

  if (src.startsWith("/media/")) {
    return `${base}/${OBJECT_PREFIX}/${src.slice("/media/".length)}`;
  }

  if (src.startsWith("/") && !src.startsWith("//")) {
    const filename = src.slice(1);
    if (filename && !filename.includes("/")) {
      return `${base}/${OBJECT_PREFIX}/${filename}`;
    }
  }

  return src;
}
