'use client';

import { CalendarClock, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { zhCN } from 'react-day-picker/locale';
import { cn } from '../../lib/utils';
import { Button } from '../button';
import { Calendar } from '../calendar';
import { Input } from '../input';
import { Popover, PopoverContent, PopoverTrigger } from '../popover';

/** "yyyy-MM-ddTHH:mm" → { date, time:"HH:mm" } */
function parseDateTimeValue(value?: string): {
  date?: Date;
  time: string;
} {
  if (!value) return { time: '09:00' };
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value);
  if (!m) return { time: '09:00' };
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const time = m[4] !== undefined && m[5] !== undefined ? `${m[4]}:${m[5]}` : '09:00';
  return { date, time };
}

function toDateTimeValue(date: Date, time: string): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const [h, min] = time.split(':');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${h ?? '09'}:${min ?? '00'}`;
}

const formatLabel = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'long',
  timeStyle: 'short',
});

export interface DateTimePickerProps {
  /** "yyyy-MM-ddTHH:mm" 或空字符串 */
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

/** shadcn 风格日期时间选择器：日历 + 时间输入，可清除 */
function DateTimePicker({
  value,
  onChange,
  placeholder = '选择日期和时间',
  id,
  disabled,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const parsed = parseDateTimeValue(value);
  const [draftDate, setDraftDate] = useState<Date | undefined>(parsed.date);
  const [draftTime, setDraftTime] = useState(parsed.time);

  useEffect(() => {
    const next = parseDateTimeValue(value);
    setDraftDate(next.date);
    setDraftTime(next.time);
  }, [value]);

  const hasValue = Boolean(parsed.date);
  const displayDate =
    parsed.date && parsed.time
      ? new Date(
          parsed.date.getFullYear(),
          parsed.date.getMonth(),
          parsed.date.getDate(),
          Number(parsed.time.split(':')[0]),
          Number(parsed.time.split(':')[1]),
        )
      : undefined;

  const commit = (date: Date | undefined, time: string) => {
    if (!date) return;
    onChange(toDateTimeValue(date, time));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          <CalendarClock className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">
            {displayDate ? formatLabel.format(displayDate) : placeholder}
          </span>
          {hasValue && (
            // biome-ignore lint/a11y/useKeyWithClickEvents: 嵌套在触发按钮内的清除角标，故意不可聚焦（tabIndex=-1），键盘用户经面板清除
            <span
              role="button"
              aria-label="清除日期时间"
              tabIndex={-1}
              className="ml-2 cursor-pointer rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onChange('');
              }}
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={zhCN}
          selected={draftDate}
          defaultMonth={draftDate}
          onSelect={(d) => {
            setDraftDate(d);
            if (d) commit(d, draftTime);
          }}
        />
        <div className="flex items-center gap-2 border-t border-border px-3 py-3">
          <span className="shrink-0 text-sm text-muted-foreground">时间</span>
          <Input
            type="time"
            value={draftTime}
            disabled={!draftDate}
            className="h-9 flex-1 appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
            onChange={(e) => {
              const nextTime = e.target.value || '09:00';
              setDraftTime(nextTime);
              if (draftDate) commit(draftDate, nextTime);
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { DateTimePicker };
