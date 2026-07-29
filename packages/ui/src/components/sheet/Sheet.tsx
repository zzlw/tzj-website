'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import type { ComponentPropsWithoutRef, HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import {
  Dialog,
  DialogClose,
  DialogTrigger,
  type DismissGuards,
  useDismissGuards,
} from '../dialog/Dialog';

/**
 * shadcn/ui Sheet（Base UI Dialog 底座的侧滑变体）。
 * Root 复用 Dialog 包装层，携带 onEscapeKeyDown/onInteractOutside 兼容拦截（LIFO 抽屉栈依赖）。
 * 状态属性：data-open / data-closed（替代 Radix 的 data-state=open/closed）。
 */
const Sheet = Dialog;
const SheetTrigger = DialogTrigger;
const SheetClose = DialogClose;
const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Backdrop
      className={cn('fixed inset-0 z-50 bg-black/80', className)}
      {...props}
      ref={ref}
    />
  ),
);
SheetOverlay.displayName = 'SheetOverlay';

export const sheetVariants = cva(
  'fixed z-50 gap-4 bg-surface p-6 shadow-lg transition ease-in-out data-[open]:animate-in data-[closed]:animate-out data-[closed]:fill-mode-forwards data-[closed]:duration-300 data-[open]:duration-500',
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 border-b border-border data-[closed]:slide-out-to-top data-[open]:slide-in-from-top',
        bottom:
          'inset-x-0 bottom-0 border-t border-border data-[closed]:slide-out-to-bottom data-[open]:slide-in-from-bottom',
        left: 'inset-y-0 left-0 h-full w-3/4 border-r border-border data-[closed]:slide-out-to-left data-[open]:slide-in-from-left sm:max-w-sm',
        right:
          'inset-y-0 right-0 h-full w-3/4 border-l border-border data-[closed]:slide-out-to-right data-[open]:slide-in-from-right sm:max-w-sm',
      },
    },
    defaultVariants: {
      side: 'right',
    },
  },
);

interface SheetContentProps
  extends ComponentPropsWithoutRef<'div'>,
    VariantProps<typeof sheetVariants>,
    DismissGuards {
  /** 遮罩层自定义 class（堆叠抽屉时可传 bg-transparent 避免双层遮罩叠加变黑） */
  overlayClassName?: string;
}

const SheetContent = forwardRef<HTMLDivElement, SheetContentProps>(
  (
    {
      side = 'right',
      className,
      overlayClassName,
      children,
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
      <SheetPortal>
        <SheetOverlay className={overlayClassName} />
        <DialogPrimitive.Popup
          ref={popupRef}
          className={cn(sheetVariants({ side }), className)}
          {...props}
        >
          {children}
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </SheetPortal>
    );
  },
);
SheetContent.displayName = 'SheetContent';

function SheetHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col space-y-2 text-center sm:text-left', className)} {...props} />
  );
}

function SheetFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
      {...props}
    />
  );
}

const SheetTitle = forwardRef<HTMLHeadingElement, ComponentPropsWithoutRef<'h2'>>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('text-lg font-semibold text-foreground', className)}
      {...props}
    />
  ),
);
SheetTitle.displayName = 'SheetTitle';

const SheetDescription = forwardRef<HTMLParagraphElement, ComponentPropsWithoutRef<'p'>>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  ),
);
SheetDescription.displayName = 'SheetDescription';

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
};
