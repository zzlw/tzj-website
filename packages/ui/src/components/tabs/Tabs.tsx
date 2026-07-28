'use client';

import { Tabs as TabsPrimitive } from '@base-ui-components/react/tabs';
import type { ComponentPropsWithoutRef } from 'react';
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

/**
 * shadcn/ui Tabs（Base UI 底座）。
 * 状态属性：Tab 为 data-active（替代 Radix 的 data-state=active）。
 * Radix 的 Trigger/Content 对应 Base UI 的 Tab/Panel；Panel 默认不保留隐藏 DOM（与 Radix 一致）。
 */

const Tabs = TabsPrimitive.Root;

// 包装层锁定自有 API（HTML props + 扩展），避免声明发射引用 Base UI 未导出的内部类型（TS4023）
const TabsList = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
        className,
      )}
      {...props}
    />
  ),
);
TabsList.displayName = 'TabsList';

type TabsTriggerProps = ComponentPropsWithoutRef<'button'> & { value: string };

const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Tab
      ref={ref}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-[color,box-shadow] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-[active]:bg-background data-[active]:text-foreground data-[active]:shadow-sm',
        className,
      )}
      {...props}
    />
  ),
);
TabsTrigger.displayName = 'TabsTrigger';

type TabsContentProps = ComponentPropsWithoutRef<'div'> & { value: string };

const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(({ className, ...props }, ref) => (
  <TabsPrimitive.Panel
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsContent, TabsList, TabsTrigger };
