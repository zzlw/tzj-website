'use client';

import { MessageSquare } from 'lucide-react';
import { toastManager } from './manager';

/** 聊天消息 toast 的 custom data（§4.2.2 base-ui custom data 模式） */
export interface ChatToastData {
  type: 'chat-message';
  roomId: string;
  clientName: string;
  clientEmail: string;
  /** 消息摘要（调用侧已截断 60 字符，附件显示 [图片]/[文件]） */
  snippet: string;
  /** 最近一条消息时间戳（ms） */
  timestamp: number;
  /** 同会话合并计数（>1 时显示「N 条新消息」） */
  count: number;
  /** 点击「查看」跳转回调（由 app 注入，如 router.push('/chat?room=<roomId>')） */
  onOpen?: () => void;
}

/** 类型守卫：Toaster 的 ToastList 据此分支渲染聊天卡片 */
export function isChatToast(data: unknown): data is ChatToastData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    (data as { type?: string }).type === 'chat-message'
  );
}

/** 相对时间（toast 生命周期短，粒度到分钟已足够） */
function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * 聊天消息通知卡片（§4.2.2）：访客名 + 消息摘要/合并计数 + 相对时间 + 「查看」跳转。
 * 渲染于 Toaster 的 Toast.Root 内（关闭按钮 <Toast.Close> 由 Toaster 统一渲染）。
 */
export function ChatMessageToast({ toastId, data }: { toastId: string; data: ChatToastData }) {
  const messageText = data.count > 1 ? `${data.count} 条新消息` : data.snippet;

  return (
    <>
      <span className="mt-0.5 shrink-0">
        <MessageSquare className="size-4 text-sky" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="truncate text-sm font-semibold">{data.clientName || data.clientEmail}</p>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {formatRelativeTime(data.timestamp)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{messageText}</p>
        <div className="mt-2">
          <button
            type="button"
            className="rounded-md border border-border px-2 py-1 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              data.onOpen?.();
              toastManager.close(toastId);
            }}
          >
            查看
          </button>
        </div>
      </div>
    </>
  );
}
