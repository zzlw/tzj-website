import { toast } from '@tzj/ui';
import { ApiError } from './apiClient';

/** 操作失败提示（优先展示 API 错误信息） */
export function notifyError(error: unknown, fallback = '操作失败') {
  const message =
    error instanceof ApiError ? error.message : typeof error === 'string' ? error : fallback;
  toast.error(message);
}

/** 操作成功提示 */
export function notifySuccess(title: string, description?: string) {
  toast.success(title, description ? { description } : undefined);
}
