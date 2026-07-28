'use client';

import { Select as SelectPrimitive } from '@base-ui-components/react/select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { ComponentPropsWithoutRef, ForwardedRef, ReactNode } from 'react';
import { Children, createContext, forwardRef, isValidElement, useContext } from 'react';
import { cn } from '../../lib/utils';

/**
 * shadcn/ui Select（Base UI 底座）。
 * 结构：Portal > Positioner（定位/z-index，提供 --anchor-width / --available-height 变量）> Popup。
 *
 * 与 Radix 的两个关键差异由包装层抹平：
 * 1. Base UI 的 Value 默认渲染原始 value 而非选中项的文本，需要 Root 上的 `items`
 *    提供 value→label 映射——包装层在渲染期遍历静态 children 自动收集 SelectItem，
 *    业务侧无需传 items；
 * 2. `SelectValue placeholder` 在 Base UI 中不存在——包装层通过 children 函数还原。
 *
 * 状态属性：Trigger 为 data-popup-open / data-placeholder，Item 为 data-highlighted /
 * data-disabled（替代 Radix 的 data-state）。
 */

type ItemsMap = Map<string, ReactNode>;

const SelectItemsContext = createContext<ItemsMap | null>(null);

/** 渲染期遍历静态 children 树，收集 SelectItem 的 value → label（不进入 SelectItem 内部）。 */
function collectItems(node: ReactNode, map: ItemsMap): void {
  for (const child of Children.toArray(node)) {
    if (!isValidElement(child)) continue;
    if (child.type === SelectItem) {
      const { value, children } = child.props as { value: string; children?: ReactNode };
      map.set(value, children);
      continue;
    }
    const { children } = child.props as { children?: ReactNode };
    if (children != null) collectItems(children, map);
  }
}

interface SelectProps
  extends Omit<
    ComponentPropsWithoutRef<typeof SelectPrimitive.Root>,
    'value' | 'defaultValue' | 'onValueChange' | 'items' | 'multiple'
  > {
  value?: string;
  defaultValue?: string;
  // method 语法（双变参数）：允许业务侧沿用 Radix 习惯传入窄化的字面量联合参数
  onValueChange?(value: string): void;
}

function Select({ children, onValueChange, ...props }: SelectProps) {
  const map: ItemsMap = new Map();
  collectItems(children, map);
  const items = Array.from(map, ([value, label]) => ({ value, label }));
  return (
    <SelectItemsContext.Provider value={map}>
      <SelectPrimitive.Root
        items={items}
        onValueChange={
          onValueChange
            ? (value: unknown) => {
                // Base UI 受控清空时可能回传 null；Radix API 只回调字符串
                if (value != null) onValueChange(String(value));
              }
            : undefined
        }
        {...props}
      >
        {children}
      </SelectPrimitive.Root>
    </SelectItemsContext.Provider>
  );
}

const SelectGroup = SelectPrimitive.Group;

type SelectValueProps = ComponentPropsWithoutRef<'span'> & { placeholder?: ReactNode };

const SelectValue = forwardRef<HTMLSpanElement, SelectValueProps>(
  ({ placeholder, children, ...props }, ref) => {
    const items = useContext(SelectItemsContext);
    return (
      <SelectPrimitive.Value ref={ref} {...props}>
        {children ??
          ((value: unknown) =>
            value == null || value === ''
              ? placeholder
              : (items?.get(value as string) ?? String(value)))}
      </SelectPrimitive.Value>
    );
  },
);
SelectValue.displayName = 'SelectValue';

// 包装层锁定自有 API（HTML props + 扩展），避免声明发射引用 Base UI 未导出的内部类型（TS4023）
const SelectTrigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'>>(
  ({ className, children, ...props }, ref) => (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        'flex h-9 w-full cursor-pointer items-center justify-between whitespace-nowrap rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] hover:bg-accent hover:text-accent-foreground focus:outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground [&>span]:line-clamp-1',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon render={<ChevronDown className="h-4 w-4 shrink-0 opacity-50" />} />
    </SelectPrimitive.Trigger>
  ),
);
SelectTrigger.displayName = 'SelectTrigger';

const SelectScrollUpButton = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.ScrollUpArrow
      ref={ref}
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <ChevronUp className="h-4 w-4" />
    </SelectPrimitive.ScrollUpArrow>
  ),
);
SelectScrollUpButton.displayName = 'SelectScrollUpButton';

const SelectScrollDownButton = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.ScrollDownArrow
      ref={ref}
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <ChevronDown className="h-4 w-4" />
    </SelectPrimitive.ScrollDownArrow>
  ),
);
SelectScrollDownButton.displayName = 'SelectScrollDownButton';

type SelectContentProps = ComponentPropsWithoutRef<'div'> & {
  /** Radix 兼容 API：popper（默认）在触发器旁弹出；item-aligned 对齐选中项。 */
  position?: 'popper' | 'item-aligned';
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
};

const SelectContent = forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children, position = 'popper', side, align, sideOffset = 4, ...props }, ref) => (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignItemWithTrigger={position === 'item-aligned'}
        className="z-50"
      >
        <SelectPrimitive.Popup
          ref={ref}
          className={cn(
            'relative max-h-[min(24rem,var(--available-height))] min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[var(--transform-origin)]',
            position === 'popper' && 'min-w-[var(--anchor-width)]',
            className,
          )}
          {...props}
        >
          <SelectScrollUpButton />
          {children}
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  ),
);
SelectContent.displayName = 'SelectContent';

const SelectLabel = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.GroupLabel
      ref={ref}
      className={cn('px-2 py-1.5 text-sm font-semibold', className)}
      {...props}
    />
  ),
);
SelectLabel.displayName = 'SelectLabel';

type SelectItemProps = ComponentPropsWithoutRef<'div'> & { value: string };

function SelectItemComponent(
  { className, children, ...props }: SelectItemProps,
  ref: ForwardedRef<HTMLDivElement>,
) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(SelectItemComponent);
SelectItem.displayName = 'SelectItem';

const SelectSeparator = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.Separator
      ref={ref}
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  ),
);
SelectSeparator.displayName = 'SelectSeparator';

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
