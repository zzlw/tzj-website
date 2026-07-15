import { type ExternalToast, toast as sonner } from 'sonner';

export type ToastOptions = ExternalToast;

const DEFAULT_DURATION = 4000;

function withDefaults(options?: ToastOptions): ToastOptions {
  return {
    duration: DEFAULT_DURATION,
    ...options,
  };
}

/** 统一操作反馈 Toast API（基于 sonner，对齐 shadcn/ui 最佳实践） */
export const toast = {
  /** 操作成功 — 如保存、发布、删除 */
  success(title: string, options?: ToastOptions) {
    return sonner.success(title, withDefaults(options));
  },

  /** 操作失败 — 如 API 错误、校验失败 */
  error(title: string, options?: ToastOptions) {
    return sonner.error(title, withDefaults({ duration: 5000, ...options }));
  },

  info(title: string, options?: ToastOptions) {
    return sonner.info(title, withDefaults(options));
  },

  warning(title: string, options?: ToastOptions) {
    return sonner.warning(title, withDefaults(options));
  },

  /** 中性消息 */
  message(title: string, options?: ToastOptions) {
    return sonner.message(title, withDefaults(options));
  },

  dismiss: sonner.dismiss,
  loading: sonner.loading,
};
