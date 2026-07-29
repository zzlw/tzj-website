'use client';

import { Toast } from '@base-ui/react/toast';
import { CircleCheck, Info, Loader2, OctagonX, TriangleAlert, X } from 'lucide-react';
import { ChatMessageToast, isChatToast } from './ChatMessageToast';
import { toastManager } from './manager';

/** type → lucide 图标（沿用迁移前 sonner 五件套 + 设计令牌） */
function ToastIcon({ type }: { type: string | undefined }) {
  switch (type) {
    case 'success':
      return <CircleCheck className="size-4 text-emerald" />;
    case 'error':
      return <OctagonX className="size-4 text-red" />;
    case 'warning':
      return <TriangleAlert className="size-4 text-amber" />;
    case 'loading':
      return <Loader2 className="size-4 animate-spin" />;
    default:
      return <Info className="size-4 text-sky" />;
  }
}

/** Provider 内部渲染 toast 列表（base-ui 无 Toast.List，需用 useToastManager 自行渲染） */
function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((t) => (
    <Toast.Root
      key={t.id}
      toast={t}
      swipeDirection={['down', 'right']}
      className="pointer-events-auto absolute right-0 bottom-0 flex w-full items-start gap-3 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg transition-all duration-300 ease-out [transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)+var(--toast-index)*-0.75rem))_scale(calc(1-var(--toast-index)*0.05))] data-[ending-style]:opacity-0 data-[starting-style]:[transform:translateY(150%)] data-[expanded]:[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-offset-y)*-1+var(--toast-index)*-0.5rem+var(--toast-swipe-movement-y)))]"
      style={{ zIndex: 100 }}
    >
      {/* §4.2.2：聊天消息卡片经类型守卫分支渲染，其余走标准反馈样式 */}
      {isChatToast(t.data) ? (
        <ChatMessageToast toastId={t.id} data={t.data} />
      ) : (
        <>
          <span className="mt-0.5 shrink-0">
            <ToastIcon type={t.type} />
          </span>
          <Toast.Content className="min-w-0 flex-1">
            <Toast.Title className="text-sm font-semibold" />
            <Toast.Description className="mt-0.5 text-xs text-muted-foreground" />
            {t.actionProps?.children && (
              <div className="mt-2">
                <Toast.Action>{t.actionProps?.children}</Toast.Action>
              </div>
            )}
          </Toast.Content>
        </>
      )}
      <Toast.Close
        aria-label="关闭"
        className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="size-4" />
      </Toast.Close>
    </Toast.Root>
  ));
}

/**
 * base-ui Toast 容器（§4.4）— 挂载于应用根布局一次即可
 * Toast.Provider(toastManager) + Portal + Viewport(bottom-right，桌面端业内惯例) + ToastList
 * 样式落位设计令牌：bg-popover / text-popover-foreground / border-border
 */
export function Toaster() {
  return (
    <Toast.Provider toastManager={toastManager}>
      <Toast.Portal>
        <Toast.Viewport className="pointer-events-auto fixed right-4 bottom-4 z-[100] w-[360px]">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
