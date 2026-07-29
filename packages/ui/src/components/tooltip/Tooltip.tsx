'use client';

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import type { ComponentPropsWithoutRef } from 'react';
import { forwardRef } from 'react';
import { toRenderProps } from '../../lib/slot';
import { cn } from '../../lib/utils';

/**
 * shadcn/ui Tooltip（Base UI 底座）。
 * 结构：Portal > Positioner（定位/z-index）> Popup（视觉样式）。
 * 状态属性：data-open / data-closed / data-side（替代 Radix 的 data-state / data-side）。
 */

type TooltipProviderProps = Omit<
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>,
  'delay'
> & {
  /** Radix 兼容 API：映射到 Base UI Provider 的 delay。 */
  delayDuration?: number;
};

function TooltipProvider({ delayDuration, ...props }: TooltipProviderProps) {
  return <TooltipPrimitive.Provider delay={delayDuration} {...props} />;
}

const Tooltip = TooltipPrimitive.Root;

// 包装层锁定自有 API（HTML props + 扩展），避免声明发射引用 Base UI 未导出的内部类型（TS4023）
type TooltipTriggerProps = ComponentPropsWithoutRef<'button'> & { asChild?: boolean };

const TooltipTrigger = forwardRef<HTMLButtonElement, TooltipTriggerProps>(
  ({ asChild, children, ...props }, ref) => (
    <TooltipPrimitive.Trigger ref={ref} {...toRenderProps(asChild, children)} {...props} />
  ),
);
TooltipTrigger.displayName = 'TooltipTrigger';

type TooltipContentProps = ComponentPropsWithoutRef<'div'> & {
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
};

const TooltipContent = forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, side = 'top', align = 'center', sideOffset = 4, ...props }, ref) => (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        className="z-[100]"
      >
        <TooltipPrimitive.Popup
          ref={ref}
          className={cn(
            'overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[closed]:animate-out data-[closed]:fill-mode-forwards data-[closed]:fade-out-0 data-[closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
            className,
          )}
          {...props}
        />
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  ),
);
TooltipContent.displayName = 'TooltipContent';

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
