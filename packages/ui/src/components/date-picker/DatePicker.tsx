"use client";

import { useState } from "react";
import { zhCN } from "react-day-picker/locale";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  formatDateLabel,
  parseDateValue,
  toDateValue,
} from "../../lib/date-utils";
import { Button } from "../button";
import { Calendar } from "../calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";

export interface DatePickerProps {
  /** "yyyy-MM-dd" 或空字符串 */
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

/** shadcn 风格日期选择器：Button + Popover + Calendar，可清除 */
function DatePicker({
  value,
  onChange,
  placeholder = "选择日期",
  id,
  disabled,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseDateValue(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-start px-3 text-left font-normal shadow-sm",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">
            {selected ? formatDateLabel.format(selected) : placeholder}
          </span>
          {selected && (
            <span
              role="button"
              aria-label="清除日期"
              tabIndex={-1}
              className="ml-2 cursor-pointer rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onChange("");
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
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            onChange(d ? toDateValue(d) : "");
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker };
