import { getStaticsUrl } from '@tzj/env';
import { API_BASE } from './config';
import { getS3PublicDomain } from './media-url';

/**
 * 获取网站 favicon URL（后台自身布局用，不缓存：永远显示最新 favicon，与 C 端解耦）。
 * 优先从 API 查询，回退到 S3 静态路径（docs/site-settings-cache-ttl-design.md §3.2）。
 */
export async function getFaviconUrl(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/site-settings/favicon`, {
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`favicon ${res.status}`);
    const json = (await res.json()) as { data?: { url: string | null } };
    return json.data?.url ?? null;
  } catch {
    // 回退：直接构造 S3 静态路径（文件不存在时浏览器静默 404）
    return getStaticsUrl(getS3PublicDomain(), 'favicon.ico');
  }
}
