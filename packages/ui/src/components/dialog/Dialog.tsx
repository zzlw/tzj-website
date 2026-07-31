'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import type {
  ComponentPropsWithoutRef,
  ForwardedRef,
  HTMLAttributes,
  MutableRefObject,
  ReactNode,
} from 'react';
import { createContext, forwardRef, useCallback, useContext, useEffect, useRef } from 'react';
import { toRenderProps } from '../../lib/slot';
import { cn } from '../../lib/utils';

/**
 * shadcn/ui Dialog（Base UI 底座）。
 * 结构：Portal > Backdrop（遮罩）+ Popup（内容，自带 fixed 居中定位）。
 * 状态属性：data-open / data-closed（替代 Radix 的 data-state=open/closed）。
 *
 * 兼容层：Base UI 没有 Content 级 onEscapeKeyDown / onPointerDownOutside / onInteractOutside，
 * 等价机制是 Root onOpenChange(open, eventDetails) 的 reason + cancel()。这里用 context 把
 * Content 上注册的 Radix 风格拦截器桥接到 Root，保证调用点（LIFO 拦截等）零改造。
 */

/** Radix 风格的可拦截关闭事件（兼容层）：仅提供业务在用的字段 */
interface DialogDismissEvent {
  target: EventTarget | null;
  /** 弹层 Popup 元素（对应 Radix 自定义事件的 currentTarget） */
  currentTarget: EventTarget | null;
  preventDefault: () => void;
}

interface DismissGuards {
  /** ESC 关闭前回调，preventDefault() 可拦截（兼容 Radix Content 同名 prop） */
  onEscapeKeyDown?: (e: DialogDismissEvent) => void;
  /** 点击遮罩/外部关闭前回调，preventDefault() 可拦截（兼容 Radix Content 同名 prop） */
  onPointerDownOutside?: (e: DialogDismissEvent) => void;
  /** 外部交互（指针/焦点移出）关闭前回调，preventDefault() 可拦截（兼容 Radix Content 同名 prop） */
  onInteractOutside?: (e: DialogDismissEvent) => void;
}

type DismissRegistry = DismissGuards & { popupEl: HTMLElement | null };

const DismissContext = createContext<MutableRefObject<DismissRegistry> | null>(null);

/** 按 Base UI 的关闭 reason 派发 Radix 风格拦截器，任一 preventDefault 即拦截关闭 */
function runDismissGuards(
  registry: DismissRegistry,
  reason: string,
  nativeEvent: Event | undefined,
): boolean {
  let prevented = false;
  const evt: DialogDismissEvent = {
    target: nativeEvent?.target ?? null,
    currentTarget: registry.popupEl,
    preventDefault: () => {
      prevented = true;
    },
  };
  if (reason === 'escape-key') {
    registry.onEscapeKeyDown?.(evt);
  } else if (reason === 'outside-press') {
    registry.onPointerDownOutside?.(evt);
    registry.onInteractOutside?.(evt);
  } else if (reason === 'focus-out') {
    registry.onInteractOutside?.(evt);
  }
  return prevented;
}

/** Content 侧注册拦截器 + popup 元素，返回合并后的 popup ref（供 Sheet 复用） */
function useDismissGuards(
  guards: DismissGuards,
  ref: ForwardedRef<HTMLDivElement>,
): (node: HTMLDivElement | null) => void {
  const registry = useContext(DismissContext);
  // 每次渲染同步最新 handler（关闭事件总发生在渲染之后）
  useEffect(() => {
    if (!registry) return;
    registry.current.onEscapeKeyDown = guards.onEscapeKeyDown;
    registry.current.onPointerDownOutside = guards.onPointerDownOutside;
    registry.current.onInteractOutside = guards.onInteractOutside;
  });
  return useCallback(
    (node: HTMLDivElement | null) => {
      if (registry) registry.current.popupEl = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [registry, ref],
  );
}

// 包装层锁定自有 API（HTML props + 扩展），避免声明发射引用 Base UI 未导出的内部类型（TS4023）
interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 'trap-focus'：仅圈定焦点，不锁页面滚动/外部指针交互 */
  modal?: boolean | 'trap-focus';
  children?: ReactNode;
}

function Dialog({ onOpenChange, children, ...props }: DialogProps) {
  const registryRef = useRef<DismissRegistry>({ popupEl: null });
  return (
    <DismissContext.Provider value={registryRef}>
      <DialogPrimitive.Root
        {...props}
        onOpenChange={(nextOpen, details) => {
          if (!nextOpen && runDismissGuards(registryRef.current, details.reason, details.event)) {
            details.cancel();
            return;
          }
          onOpenChange?.(nextOpen);
        }}
      >
        {children}
      </DialogPrimitive.Root>
    </DismissContext.Provider>
  );
}

type DialogTriggerProps = ComponentPropsWithoutRef<'button'> & { asChild?: boolean };

const DialogTrigger = forwardRef<HTMLButtonElement, DialogTriggerProps>(
  ({ asChild, children, ...props }, ref) => (
    <DialogPrimitive.Trigger ref={ref} {...toRenderProps(asChild, children)} {...props} />
  ),
);
DialogTrigger.displayName = 'DialogTrigger';

const DialogPortal = DialogPrimitive.Portal;

type DialogCloseProps = ComponentPropsWithoutRef<'button'> & { asChild?: boolean };

const DialogClose = forwardRef<HTMLButtonElement, DialogCloseProps>(
  ({ asChild, children, ...props }, ref) => (
    <DialogPrimitive.Close ref={ref} {...toRenderProps(asChild, children)} {...props} />
  ),
);
DialogClose.displayName = 'DialogClose';

const DialogOverlay = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Backdrop
      ref={ref}
      className={cn(
        'fixed inset-0 z-50 bg-black/80 data-[open]:animate-in data-[closed]:animate-out data-[closed]:fill-mode-forwards data-[closed]:fade-out-0 data-[open]:fade-in-0',
        className,
      )}
      {...props}
    />
  ),
);
DialogOverlay.displayName = 'DialogOverlay';

type DialogContentProps = ComponentPropsWithoutRef<'div'> &
  DismissGuards & {
    overlayClassName?: string;
    /** 内置右上角关闭按钮自定义 class（如深色头图上的白色 X） */
    closeClassName?: string;
  };

const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
  (
    {
      className,
      children,
      overlayClassName,
      closeClassName,
      onEscapeKeyDown,
      onPointerDownOutside,
      onInteractOutside,
      ...props
    },
    ref,
  ) => {
    const popupRef = useDismissGuards(
      { onEscapeKeyDown, onPointerDownOutside, onInteractOutside },
      ref,
    );
    return (
      <DialogPortal>
        <DialogOverlay className={overlayClassName} />
        <DialogPrimitive.Popup
          ref={popupRef}
          className={cn(
            'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-surface p-6 shadow-lg duration-200 data-[open]:animate-in data-[closed]:animate-out data-[closed]:fill-mode-forwards data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[closed]:slide-out-to-left-1/2 data-[closed]:slide-out-to-top-[48%] data-[open]:slide-in-from-left-1/2 data-[open]:slide-in-from-top-[48%] sm:rounded-lg',
            className,
          )}
          {...props}
        >
          {children}
          <DialogPrimitive.Close
            className={cn(
              'absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none',
              closeClassName,
            )}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = 'DialogContent';

function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
      {...props}
    />
  );
}

const DialogTitle = forwardRef<HTMLHeadingElement, ComponentPropsWithoutRef<'h2'>>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  ),
);
DialogTitle.displayName = 'DialogTitle';

const DialogDescription = forwardRef<HTMLParagraphElement, ComponentPropsWithoutRef<'p'>>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  ),
);
DialogDescription.displayName = 'DialogDescription';

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  type DismissGuards,
  // 供 Sheet 复用的内部兼容层（不经 index.ts 公开）
  useDismissGuards,
};
