'use client';

import { ScrollArea as ScrollAreaPrimitive } from '@base-ui-components/react/scroll-area';
import type { ComponentPropsWithoutRef } from 'react';
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

/**
 * shadcn/ui ScrollArea（Base UI 底座）。
 * Base UI 的 Scrollbar 常驻 DOM，通过 data-hovering / data-scrolling 控制透明度，
 * 等价还原 Radix 的 type="hover"（默认）与 type="always" 两种可见性行为。
 * Viewport 带 data-slot="scroll-area-viewport" 供业务侧选择器定位（替代 data-radix-scroll-area-viewport）。
 */

type ScrollAreaProps = ComponentPropsWithoutRef<'div'> & {
  /** Radix 兼容 API：仅区分 always（常显）与其余值（悬停/滚动时显示）。 */
  type?: 'auto' | 'always' | 'scroll' | 'hover';
};

const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, type = 'hover', ...props }, ref) => (
    <ScrollAreaPrimitive.Root
      ref={ref}
      className={cn('relative overflow-hidden', className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="h-full w-full rounded-[inherit]"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar forceVisible={type === 'always'} />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  ),
);
ScrollArea.displayName = 'ScrollArea';

type ScrollBarProps = ComponentPropsWithoutRef<'div'> & {
  orientation?: 'vertical' | 'horizontal';
  /** 常显滚动条（对应 Radix type="always"）。 */
  forceVisible?: boolean;
};

const ScrollBar = forwardRef<HTMLDivElement, ScrollBarProps>(
  ({ className, orientation = 'vertical', forceVisible = false, ...props }, ref) => (
    <ScrollAreaPrimitive.Scrollbar
      ref={ref}
      orientation={orientation}
      className={cn(
        'flex touch-none select-none',
        orientation === 'vertical' && 'h-full w-2.5 border-l border-l-transparent p-px',
        orientation === 'horizontal' && 'h-2.5 flex-col border-t border-t-transparent p-px',
        !forceVisible &&
          'opacity-0 transition-opacity duration-150 data-[hovering]:opacity-100 data-[scrolling]:opacity-100',
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-border-strong/80 hover:bg-border-strong" />
    </ScrollAreaPrimitive.Scrollbar>
  ),
);
ScrollBar.displayName = 'ScrollBar';

export { ScrollArea, ScrollBar };
