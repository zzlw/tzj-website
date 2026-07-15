'use client';

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import type { ComponentProps } from 'react';
import { DayPicker, getDefaultClassNames } from 'react-day-picker';
import { cn } from '../../lib/utils';

export type CalendarProps = ComponentProps<typeof DayPicker>;

/** shadcn 风格日历（react-day-picker），供 DatePicker 及独立日期选择场景使用 */
function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  const defaults = getDefaultClassNames();
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        root: cn(defaults.root, 'w-fit'),
        months: 'relative flex flex-col gap-4 sm:flex-row',
        month: 'flex w-full flex-col gap-4',
        month_caption: 'flex h-8 items-center justify-center px-8',
        caption_label: 'select-none text-sm font-medium',
        nav: 'absolute inset-x-0 top-0 flex h-8 w-full items-center justify-between',
        button_previous:
          'inline-flex h-8 w-8 cursor-pointer select-none items-center justify-center rounded-md bg-transparent text-foreground/80 transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40',
        button_next:
          'inline-flex h-8 w-8 cursor-pointer select-none items-center justify-center rounded-md bg-transparent text-foreground/80 transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-8 select-none text-[0.8rem] font-normal text-muted-foreground',
        week: 'mt-2 flex w-full',
        day: 'group/day relative aspect-square h-8 w-8 select-none p-0 text-center text-sm',
        day_button:
          'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md font-normal transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed',
        selected:
          '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:font-medium',
        today: '[&>button]:bg-accent [&>button]:font-medium',
        outside: 'text-muted-foreground/60 [&>button]:hover:bg-transparent',
        disabled: 'text-muted-foreground opacity-40',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ className: cls, orientation }) => {
          const Icon =
            orientation === 'left'
              ? ChevronLeft
              : orientation === 'right'
                ? ChevronRight
                : orientation === 'up'
                  ? ChevronUp
                  : ChevronDown;
          return <Icon className={cn('h-4 w-4', cls)} />;
        },
      }}
      {...props}
    />
  );
}

export { Calendar };
