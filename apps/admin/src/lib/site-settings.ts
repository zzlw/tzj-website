import { API_BASE } from './config';
import { getS3PublicDomain } from './media-url';

/**
 * 获取网站 favicon URL（ISR 缓存策略）。
 * - 生产环境：300 秒（5 分钟）
 * - 开发环境：0 秒，即时生效
 * 优先从 API 查询，回退到 S3 静态路径。
 */
export async function getFaviconUrl(): Promise<string | null> {
  const isDev = process.env.NODE_ENV === 'development';
  const revalidateTime = isDev ? 0 : 300;

  try {
    const res = await fetch(`${API_BASE}/site-settings/favicon`, {
      next: { revalidate: revalidateTime, tags: ['site-settings'] },
    });
    if (!res.ok) throw new Error(`favicon ${res.status}`);
    const json = (await res.json()) as { data?: { url: string | null } };
    return json.data?.url ?? null;
  } catch {
    // 回退：直接构造 S3 静态路径（文件不存在时浏览器静默 404）
    return `${getS3PublicDomain().replace(/\/$/, '')}/statics/favicon.ico`;
  }
}
