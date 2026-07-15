'use client';

import { CalendarIcon, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { zhCN } from 'react-day-picker/locale';
import { formatDateLabel, parseDateValue, toDateValue } from '../../lib/date-utils';
import { cn } from '../../lib/utils';
import { Button } from '../button';
import { Calendar } from '../calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../popover';

export interface DateRangePickerProps {
  /** 开始日期 "yyyy-MM-dd" */
  from?: string;
  /** 结束日期 "yyyy-MM-dd" */
  to?: string;
  onChange: (range: { from: string; to: string }) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

function toSelectedRange(from?: string, to?: string): DateRange | undefined {
  const fromDate = parseDateValue(from);
  const toDate = parseDateValue(to);
  if (!fromDate && !toDate) return undefined;
  return { from: fromDate, to: toDate };
}

function formatRangeLabel(from?: string, to?: string): string | null {
  const fromDate = parseDateValue(from);
  const toDate = parseDateValue(to);
  if (fromDate && toDate) {
    return `${formatDateLabel.format(fromDate)} – ${formatDateLabel.format(toDate)}`;
  }
  if (fromDate) return formatDateLabel.format(fromDate);
  return null;
}

function isRangeComplete(range: DateRange | undefined): range is Required<DateRange> {
  return Boolean(range?.from && range?.to);
}

/** shadcn 风格日期范围选择器：Popover + Calendar（mode="range"） */
function DateRangePicker({
  from,
  to,
  onChange,
  placeholder = '选择日期范围',
  id,
  disabled,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();
  const [month, setMonth] = useState<Date | undefined>();

  const committed = useMemo(() => toSelectedRange(from, to), [from, to]);
  const label = formatRangeLabel(from, to);
  const hasValue = Boolean(from || to);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDraft(committed);
      setMonth(committed?.from ?? committed?.to ?? new Date());
    } else {
      setDraft(undefined);
    }
    setOpen(nextOpen);
  }

  function handleSelect(range: DateRange | undefined) {
    if (!range?.from) {
      setDraft(undefined);
      return;
    }

    setDraft(range);

    if (isRangeComplete(range)) {
      onChange({
        from: toDateValue(range.from),
        to: toDateValue(range.to),
      });
      setOpen(false);
      setDraft(undefined);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'h-9 w-full justify-start px-3 text-left font-normal shadow-sm',
            !hasValue && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">{label ?? placeholder}</span>
          {hasValue ? (
            <span
              role="button"
              aria-label="清除日期范围"
              tabIndex={-1}
              className="ml-2 cursor-pointer rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onChange({ from: '', to: '' });
                setDraft(undefined);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Calendar
          mode="range"
          locale={zhCN}
          numberOfMonths={2}
          month={month}
          onMonthChange={setMonth}
          selected={draft}
          onSelect={handleSelect}
          /** 已有完整范围或未选时，第一次点击只设开始日，便于重新选择 */
          resetOnSelect
          classNames={{
            range_start:
              'rounded-l-md bg-primary [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary',
            range_end:
              'rounded-r-md bg-primary [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary',
            range_middle: 'bg-accent [&>button]:bg-transparent [&>button]:text-foreground',
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export { DateRangePicker };
