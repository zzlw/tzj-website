'use client';

import { PreviewCard as PreviewCardPrimitive } from '@base-ui/react/preview-card';
import type { ComponentPropsWithoutRef } from 'react';
import { createContext, forwardRef, useContext, useMemo } from 'react';
import { toRenderProps } from '../../lib/slot';
import { cn } from '../../lib/utils';

/**
 * shadcn/ui HoverCard（Base UI 底座，对应组件更名为 PreviewCard）。
 * 结构：Portal > Positioner（定位/z-index）> Popup（视觉样式）。
 * Radix 的 openDelay/closeDelay 在 Root 上，Base UI 移到了 Trigger 上——
 * 包装层用 context 桥接，保持 Root 级 API 不变。
 */

interface HoverCardDelay {
  openDelay?: number;
  closeDelay?: number;
}

const HoverCardDelayContext = createContext<HoverCardDelay>({});

type HoverCardProps = ComponentPropsWithoutRef<typeof PreviewCardPrimitive.Root> & HoverCardDelay;

function HoverCard({ openDelay, closeDelay, ...props }: HoverCardProps) {
  const delays = useMemo(() => ({ openDelay, closeDelay }), [openDelay, closeDelay]);
  return (
    <HoverCardDelayContext.Provider value={delays}>
      <PreviewCardPrimitive.Root {...props} />
    </HoverCardDelayContext.Provider>
  );
}

type HoverCardTriggerProps = ComponentPropsWithoutRef<'a'> & { asChild?: boolean };

const HoverCardTrigger = forwardRef<HTMLAnchorElement, HoverCardTriggerProps>(
  ({ asChild, children, ...props }, ref) => {
    const { openDelay, closeDelay } = useContext(HoverCardDelayContext);
    return (
      <PreviewCardPrimitive.Trigger
        ref={ref}
        delay={openDelay}
        closeDelay={closeDelay}
        {...toRenderProps(asChild, children)}
        {...props}
      />
    );
  },
);
HoverCardTrigger.displayName = 'HoverCardTrigger';

type HoverCardContentProps = ComponentPropsWithoutRef<'div'> & {
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
};

const HoverCardContent = forwardRef<HTMLDivElement, HoverCardContentProps>(
  ({ className, side = 'bottom', align = 'center', sideOffset = 4, ...props }, ref) => (
    <PreviewCardPrimitive.Portal>
      <PreviewCardPrimitive.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        className="z-50"
      >
        <PreviewCardPrimitive.Popup
          ref={ref}
          className={cn(
            'w-64 rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-md outline-none',
            'data-[open]:animate-in data-[closed]:animate-out data-[closed]:fill-mode-forwards data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
            className,
          )}
          {...props}
        />
      </PreviewCardPrimitive.Positioner>
    </PreviewCardPrimitive.Portal>
  ),
);
HoverCardContent.displayName = 'HoverCardContent';

export { HoverCard, HoverCardContent, HoverCardTrigger };
