import { Slider as SliderPrimitive } from '@base-ui/react/slider';
import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * shadcn/ui Slider（Base UI 底座）。
 * 兼容层：保留 Radix 时代的 API 形态——value 固定为 number[]、`onValueCommit` prop 名
 * （内部转 Base UI 的 `onValueCommitted`），业务侧与 AudioPlayer 的调用点零改造。
 */
type SliderProps = Omit<
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>,
  'value' | 'defaultValue' | 'onValueChange' | 'onValueCommitted'
> & {
  value?: number[];
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
  onValueCommit?: (value: number[]) => void;
};

const toArray = (value: number | readonly number[]): number[] =>
  Array.isArray(value) ? [...value] : [value as number];

const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>(
  ({ className, onValueChange, onValueCommit, ...props }, ref) => (
    <SliderPrimitive.Root
      ref={ref}
      onValueChange={onValueChange ? (value) => onValueChange(toArray(value)) : undefined}
      onValueCommitted={onValueCommit ? (value) => onValueCommit(toArray(value)) : undefined}
      className={cn(
        'relative flex w-full touch-none select-none items-center cursor-pointer disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Control className="flex w-full items-center py-1.5">
        {/* Thumb 在 Track 内部（Base UI 结构），Track 不可 overflow-hidden，否则裁掉 Thumb */}
        <SliderPrimitive.Track className="relative h-1.5 w-full grow cursor-pointer rounded-full bg-primary/20 disabled:cursor-not-allowed">
          <SliderPrimitive.Indicator className="absolute h-full rounded-full bg-primary" />
          <SliderPrimitive.Thumb className="block h-4 w-4 cursor-grab rounded-full border border-primary/50 bg-background shadow-sm transition-colors active:cursor-grabbing focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50" />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  ),
);
Slider.displayName = 'Slider';

export { Slider };
