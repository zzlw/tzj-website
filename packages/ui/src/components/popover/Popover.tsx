'use client';

import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import type { ComponentPropsWithoutRef } from 'react';
import { forwardRef } from 'react';
import { toRenderProps } from '../../lib/slot';
import { cn } from '../../lib/utils';

/**
 * shadcn/ui Popover（Base UI 底座）。
 * 结构：Portal > Positioner（定位/z-index，提供 --anchor-width 变量）> Popup（视觉样式）。
 * 状态属性：data-open / data-closed / data-side（替代 Radix 的 data-state / data-side）。
 */

const Popover = PopoverPrimitive.Root;

// 包装层锁定自有 API（HTML props + 扩展），避免声明发射引用 Base UI 未导出的内部类型（TS4023）
type PopoverTriggerProps = ComponentPropsWithoutRef<'button'> & { asChild?: boolean };

const PopoverTrigger = forwardRef<HTMLButtonElement, PopoverTriggerProps>(
  ({ asChild, children, ...props }, ref) => (
    <PopoverPrimitive.Trigger ref={ref} {...toRenderProps(asChild, children)} {...props} />
  ),
);
PopoverTrigger.displayName = 'PopoverTrigger';

type PopoverContentProps = ComponentPropsWithoutRef<'div'> & {
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  /** 打开时的焦点行为（替代 Radix 的 onOpenAutoFocus）：false 表示不移动焦点 */
  initialFocus?: boolean;
};

const PopoverContent = forwardRef<HTMLDivElement, PopoverContentProps>(
  (
    { className, side = 'bottom', align = 'center', sideOffset = 4, initialFocus, ...props },
    ref,
  ) => (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        className="z-50"
      >
        <PopoverPrimitive.Popup
          ref={ref}
          initialFocus={initialFocus}
          className={cn(
            'w-72 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[open]:animate-in data-[closed]:animate-out data-[closed]:fill-mode-forwards data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  ),
);
PopoverContent.displayName = 'PopoverContent';

export { Popover, PopoverContent, PopoverTrigger };
