/**
 * retryFetch — 网络请求容错重试
 *
 * 针对 API 服务启动延迟（ECONNREFUSED）或偶发网络抖动，
 * 自动重试幂等请求（GET / HEAD），写操作仅在明确开启 retryWrites 时重试。
 */

interface RetryOptions {
  /** 最大重试次数，默认 2（共尝试 3 次） */
  retries?: number;
  /** 基础延迟毫秒，实际等待 = baseMs * (attempt + 1)，默认 300 */
  baseDelayMs?: number;
  /** 是否对写操作（POST/PUT/PATCH/DELETE）也重试，默认 false */
  retryWrites?: boolean;
}

const DEFAULT_RETRIES = 2;
const DEFAULT_BASE_DELAY_MS = 300;

function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const cause = (err as Error & { cause?: { code?: string } }).cause;
  if (cause?.code === 'ECONNREFUSED' || cause?.code === 'ECONNRESET') return true;
  return err.name === 'AbortError';
}

export async function retryFetch(
  input: string | URL,
  init: RequestInit = {},
  opts: RetryOptions = {},
): Promise<Response> {
  const {
    retries = DEFAULT_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    retryWrites = false,
  } = opts;

  const method = (init.method ?? 'GET').toUpperCase();
  const canRetry = retryWrites || ['GET', 'HEAD', 'OPTIONS'].includes(method);

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(input, init);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (!canRetry || !isRetryable(err) || attempt >= retries) break;
      await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
  }

  throw lastError ?? new Error('Unknown fetch error');
}
