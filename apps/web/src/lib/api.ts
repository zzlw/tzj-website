import type {
  ApiResponse,
  Blog,
  Case,
  Contact,
  CreateContactDto,
  News,
  PaginatedResponse,
  TradeShow,
} from '@tzj/types';
import { getVisitorId } from './analytics';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  timeout?: number;
  retries?: number;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchApi<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { params, timeout = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES, ...fetchOpts } = options;

  let url = `${API_BASE}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.set(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(
        url,
        {
          ...fetchOpts,
          headers: {
            'Content-Type': 'application/json',
            ...fetchOpts.headers,
          },
          next: fetchOpts.method === 'POST' ? undefined : { revalidate: 60 },
        },
        timeout,
      );

      if (!res.ok) {
        throw new ApiError(`API Error: ${res.status} ${res.statusText}`, res.status);
      }

      return res.json() as Promise<T>;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries && !(err instanceof ApiError && err.status < 500)) {
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        continue;
      }
      break;
    }
  }

  throw lastError ?? new Error('Unknown API error');
}

/** 网站联系表单提交载荷 */
export interface WebsiteContactPayload {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  message: string;
  subject?: string;
  source?: string;
  /** 阿里云验证码 CaptchaVerifyParam */
  captchaVerifyParam?: string;
}

export const getCases = (params?: Record<string, string | number | boolean | undefined>) =>
  fetchApi<PaginatedResponse<Case>>('/cases', { params });

export const getCase = (slug: string) => fetchApi<ApiResponse<Case>>(`/cases/${slug}`);

export const getNewsList = (params?: Record<string, string | number | boolean | undefined>) =>
  fetchApi<PaginatedResponse<News>>('/news', { params });

export const getNewsItem = (slug: string) => fetchApi<ApiResponse<News>>(`/news/${slug}`);

export const getBlogs = (params?: Record<string, string | number | boolean | undefined>) =>
  fetchApi<PaginatedResponse<Blog>>('/blogs', { params });

export const getBlog = (slug: string) => fetchApi<ApiResponse<Blog>>(`/blogs/${slug}`);

export const getTradeShows = (params?: Record<string, string | number | boolean | undefined>) =>
  fetchApi<PaginatedResponse<TradeShow>>('/trade-shows', { params });

export const getTradeShow = (slug: string) =>
  fetchApi<ApiResponse<TradeShow>>(`/trade-shows/${slug}`);

export const getPages = () => fetchApi<ApiResponse<unknown[]>>('/pages');

export const getPage = (slug: string) => fetchApi<ApiResponse<unknown>>(`/pages/${slug}`);

export const submitContact = (data: WebsiteContactPayload) => {
  const email = data.email?.trim() ?? '';
  const payload: CreateContactDto = {
    name: data.name,
    phone: data.phone,
    email,
    company: data.company,
    subject: data.subject || '网站咨询',
    message: data.message,
    source: data.source || 'website',
    // 持久匿名访客 ID（_tzj_vid，与埋点同源）：把询盘锚定到浏览轨迹
    visitorId: getVisitorId() || undefined,
  };

  const headers: Record<string, string> = {};
  if (data.captchaVerifyParam) {
    headers['X-Captcha-Verify-Param'] = data.captchaVerifyParam;
  }

  return fetchApi<ApiResponse<Contact>>('/contact', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers,
    retries: 0,
  });
};
