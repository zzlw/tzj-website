import { toast } from '@tzj/ui';
import { ApiError } from './apiClient';

/**
 * 操作失败提示：优先展示具体原因（API 错误/校验文案/异常 message），
 * 仅在拿不到任何可读信息时才退到 fallback，避免笼统的「操作失败」。
 */
export function notifyError(error: unknown, fallback = '操作失败') {
  let message: string;
  if (error instanceof ApiError) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error instanceof Error && error.message.trim()) {
    // fetch 网络层失败是英文技术文案（Failed to fetch / Load failed），转成用户可读的中文
    message = /fetch|load failed|network/i.test(error.message)
      ? '网络异常，请检查连接后重试'
      : error.message;
  } else {
    message = fallback;
  }
  toast.error(message);
}

/** 操作成功提示 */
export function notifySuccess(title: string, description?: string) {
  toast.success(title, description ? { description } : undefined);
}
