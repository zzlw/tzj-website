'use client';

import { AlertDialog as AlertDialogPrimitive } from '@base-ui-components/react/alert-dialog';
import type { ComponentPropsWithoutRef, HTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';
import { toRenderProps } from '../../lib/slot';
import { cn } from '../../lib/utils';
import { buttonVariants } from '../button/Button';

/**
 * shadcn/ui Alert Dialog（Base UI 底座）。
 * 结构：Portal > Backdrop（遮罩）+ Popup（内容）。ESC/点外部默认不关闭（AlertDialog 语义）。
 * Base UI 无 Action/Cancel 部件，二者均映射为 Close + 按钮样式（点击即关闭，行为与 Radix 一致）。
 * 状态属性：data-open / data-closed（替代 Radix 的 data-state=open/closed）。
 */

// 包装层锁定自有 API，避免声明发射引用 Base UI 未导出的内部类型（TS4023）
interface AlertDialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}

function AlertDialog({ onOpenChange, children, ...props }: AlertDialogProps) {
  return (
    <AlertDialogPrimitive.Root {...props} onOpenChange={(open) => onOpenChange?.(open)}>
      {children}
    </AlertDialogPrimitive.Root>
  );
}

type AlertDialogTriggerProps = ComponentPropsWithoutRef<'button'> & { asChild?: boolean };

const AlertDialogTrigger = forwardRef<HTMLButtonElement, AlertDialogTriggerProps>(
  ({ asChild, children, ...props }, ref) => (
    <AlertDialogPrimitive.Trigger ref={ref} {...toRenderProps(asChild, children)} {...props} />
  ),
);
AlertDialogTrigger.displayName = 'AlertDialogTrigger';

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Backdrop
      ref={ref}
      className={cn(
        'fixed inset-0 z-50 bg-black/80 data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0',
        className,
      )}
      {...props}
    />
  ),
);
AlertDialogOverlay.displayName = 'AlertDialogOverlay';

const AlertDialogContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Popup
        ref={ref}
        className={cn(
          'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-surface p-6 shadow-lg duration-200 data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[closed]:slide-out-to-left-1/2 data-[closed]:slide-out-to-top-[48%] data-[open]:slide-in-from-left-1/2 data-[open]:slide-in-from-top-[48%] sm:rounded-lg',
          className,
        )}
        {...props}
      />
    </AlertDialogPortal>
  ),
);
AlertDialogContent.displayName = 'AlertDialogContent';

function AlertDialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col space-y-2 text-center sm:text-left', className)} {...props} />
  );
}

function AlertDialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
      {...props}
    />
  );
}

const AlertDialogTitle = forwardRef<HTMLHeadingElement, ComponentPropsWithoutRef<'h2'>>(
  ({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Title
      ref={ref}
      className={cn('text-lg font-semibold', className)}
      {...props}
    />
  ),
);
AlertDialogTitle.displayName = 'AlertDialogTitle';

const AlertDialogDescription = forwardRef<HTMLParagraphElement, ComponentPropsWithoutRef<'p'>>(
  ({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Description
      ref={ref}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  ),
);
AlertDialogDescription.displayName = 'AlertDialogDescription';

const AlertDialogAction = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'>>(
  ({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Close ref={ref} className={cn(buttonVariants(), className)} {...props} />
  ),
);
AlertDialogAction.displayName = 'AlertDialogAction';

const AlertDialogCancel = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'>>(
  ({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Close
      ref={ref}
      className={cn(buttonVariants({ variant: 'outline' }), 'mt-2 sm:mt-0', className)}
      {...props}
    />
  ),
);
AlertDialogCancel.displayName = 'AlertDialogCancel';

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
};
