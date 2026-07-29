/**
 * @tzj/ui Toast API（基于 base-ui）
 *
 * 统一操作反馈 Toast，对齐 shadcn/ui 最佳实践。
 * 包含标准操作反馈 + 聊天消息卡片专用 API。
 */

import type { ToastObject } from '@base-ui/react/toast';
import type { ChatToastData } from './ChatMessageToast';
import { toastManager } from './manager';

export type ToastOptions = Partial<Omit<ToastObject<object>, 'id' | 'data'>>;

/** toast.chatMessage 入参（§4.2.2）：卡片数据由调用侧提供，timestamp/count 由适配层维护 */
export interface ChatMessageToastInput {
  roomId: string;
  clientName: string;
  clientEmail: string;
  /** 消息摘要（调用侧截断 60 字符，附件显示 [图片]/[文件]） */
  snippet: string;
  /** 点击「查看」跳转回调（app 注入，如 router.push('/chat?room=<roomId>')） */
  onOpen?: () => void;
}

const DEFAULT_DURATION = 4000;
const CHAT_TOAST_TIMEOUT = 5000;

/**
 * 活跃聊天 toast 追踪（§4.2.2 同会话合并）：base-ui manager 是纯事件总线、
 * 无状态可查，因此适配层自维护存活表：onClose 回调删除条目，expiresAt 作为
 * onClose 未触发时的防御判定（hover 暂停计时器时卡片存活可能超过 expiresAt，
 * 此时走 close+add 重建，避免同 id 重复 add）。
 */
const activeChatToasts = new Map<string, { count: number; expiresAt: number }>();

function withDefaults(options?: ToastOptions): ToastOptions {
  return {
    timeout: options?.timeout ?? DEFAULT_DURATION,
    ...options,
  };
}

/** 标准操作反馈 */
export const toast = {
  /** 操作成功 — 如保存、发布、删除 */
  success(title: string, options?: ToastOptions) {
    const id = toastManager.add({
      title,
      type: 'success',
      ...withDefaults(options),
    });
    return id;
  },

  /** 操作失败 — 如 API 错误、校验失败 */
  error(title: string, options?: ToastOptions) {
    const id = toastManager.add({
      title,
      type: 'error',
      timeout: 5000,
      ...options,
    });
    return id;
  },

  info(title: string, options?: ToastOptions) {
    const id = toastManager.add({
      title,
      type: 'info',
      ...withDefaults(options),
    });
    return id;
  },

  warning(title: string, options?: ToastOptions) {
    const id = toastManager.add({
      title,
      type: 'warning',
      ...withDefaults(options),
    });
    return id;
  },

  /** 中性消息 */
  message(title: string, options?: ToastOptions) {
    const id = toastManager.add({
      title,
      type: 'default',
      ...withDefaults(options),
    });
    return id;
  },

  dismiss: (id?: string) => {
    if (id) {
      toastManager.close(id);
    }
  },

  /**
   * 聊天消息 Toast 卡片（§4.2.2）— upsert 语义：
   * 同 `chat-msg-<roomId>` 卡片存活 → toastManager.update 计数递增（显示「N 条新消息」），
   * 否则 add 新卡片；同 roomId 新消息更新同一张卡片，避免轰炸。
   * 渲染侧由 Toaster 的 ToastList 经 isChatToast 分支到 ChatMessageToast。
   */
  chatMessage(input: ChatMessageToastInput) {
    const id = `chat-msg-${input.roomId}`;
    const now = Date.now();
    const data: ChatToastData = {
      type: 'chat-message',
      roomId: input.roomId,
      clientName: input.clientName,
      clientEmail: input.clientEmail,
      snippet: input.snippet,
      timestamp: now,
      count: 1,
      onOpen: input.onOpen,
    };

    const active = activeChatToasts.get(id);
    if (active && now < active.expiresAt) {
      // 卡片仍存活 → 合并计数（add/update 是分离 API，不假设同 id add 即 upsert）
      active.count += 1;
      toastManager.update(id, {
        title: data.clientName || data.clientEmail,
        data: { ...data, count: active.count },
      });
      return id;
    }

    // 新建（若存在 hover 续命的残留卡片先关闭，防同 id 重复 add）
    if (active) toastManager.close(id);
    activeChatToasts.set(id, { count: 1, expiresAt: now + CHAT_TOAST_TIMEOUT });
    toastManager.add({
      id,
      title: data.clientName || data.clientEmail,
      type: 'chat-message',
      timeout: CHAT_TOAST_TIMEOUT,
      data,
      onClose: () => activeChatToasts.delete(id),
    });
    return id;
  },

  loading: (title: string, options?: ToastOptions) => {
    const id = toastManager.add({
      title,
      type: 'loading',
      ...withDefaults(options),
    });
    return id;
  },
};
