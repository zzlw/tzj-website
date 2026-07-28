'use client';

import { Collapsible as CollapsiblePrimitive } from '@base-ui-components/react/collapsible';
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from 'react';
import { forwardRef } from 'react';
import { toRenderProps } from '../../lib/slot';

/**
 * shadcn/ui Collapsible（Base UI 底座）。
 * 状态属性：Trigger 为 data-panel-open，Panel 为 data-open / data-closed（替代 Radix 的 data-state）。
 */
const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = forwardRef<
  ElementRef<typeof CollapsiblePrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Trigger> & {
    asChild?: boolean;
    children?: ReactNode;
  }
>(({ asChild, children, ...props }, ref) => (
  <CollapsiblePrimitive.Trigger ref={ref} {...toRenderProps(asChild, children)} {...props} />
));
CollapsibleTrigger.displayName = 'CollapsibleTrigger';

const CollapsibleContent = CollapsiblePrimitive.Panel;

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
