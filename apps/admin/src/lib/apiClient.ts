import { BASE_PATH } from "./config";

const BFF = `${BASE_PATH}/api/bff`;

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListResult<T> {
  data: T[];
  pagination: Pagination;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Params = Record<string, string | number | boolean | undefined | null>;

function qs(params?: Params): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ data: T; pagination?: Pagination }> {
  const res = await fetch(`${BFF}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });

  let body: {
    success?: boolean;
    data?: T;
    pagination?: Pagination;
    error?: { code?: string; message?: string | string[]; details?: unknown };
    message?: string;
  } | null = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok || !body || body.success === false) {
    const raw = body?.error?.message ?? body?.message ?? `请求失败 (${res.status})`;
    const msg = Array.isArray(raw) ? raw[0] ?? `请求失败 (${res.status})` : raw;
    throw new ApiError(msg, res.status, body?.error?.code, body?.error?.details);
  }

  return { data: body.data as T, pagination: body.pagination };
}

type ApiRemoveOpts = { purge?: boolean; query?: Params };

export const api = {
  list: <T>(resource: string, params?: Params) =>
    request<T[]>(`/${resource}${qs(params)}`).then((r) => ({
      data: r.data,
      pagination: r.pagination as Pagination,
    })),
  get: <T>(resource: string, idOrSlug: string) =>
    request<T>(`/${resource}/${idOrSlug}`).then((r) => r.data),
  create: <T>(resource: string, payload: unknown) =>
    request<T>(`/${resource}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }).then((r) => r.data),
  update: <T>(resource: string, id: string, payload: unknown) =>
    request<T>(`/${resource}/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }).then((r) => r.data),
  remove: (resource: string, id: string, opts?: ApiRemoveOpts) =>
    request<unknown>(
      `/${resource}/${id}${opts?.purge ? "/purge" : ""}${qs(opts?.query)}`,
      { method: "DELETE" },
    ).then(() => true),
  patch: <T>(path: string, payload: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }).then((r) => r.data),
  post: <T>(path: string, payload: unknown, params?: Params) =>
    request<T>(
      `${path.startsWith("/") ? path : `/${path}`}${qs(params)}`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ).then((r) => r.data),
  put: <T>(path: string, payload: unknown, params?: Params) =>
    request<T>(
      `${path.startsWith("/") ? path : `/${path}`}${qs(params)}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    ).then((r) => r.data),
  /** GET 单资源或聚合接口（支持 query，如 analytics/overview） */
  query: <T>(path: string, params?: Params) =>
    request<T>(`/${path}${qs(params)}`).then((r) => r.data),
};
