'use client';

import type { ContentOption } from '@/lib/content-labels';
import { cn } from '@/lib/utils';

interface ContentCategoryTabsProps {
  paramKey: string;
  allLabel: string;
  options: ContentOption[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

/** C 端分类/类型 Tab（值与 API query 参数一致）。 */
export function ContentCategoryTabs({
  paramKey,
  allLabel,
  options,
  value,
  onChange,
}: ContentCategoryTabsProps) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label={allLabel.replace(/^全部/, '')}>
      <button
        type="button"
        role="tab"
        aria-selected={!value}
        className={cn(
          'px-4 py-2 text-sm font-bold transition-colors',
          !value
            ? 'bg-primary text-white'
            : 'border border-neutral-300 bg-white text-neutral-900 hover:border-neutral-900',
        )}
        onClick={() => onChange(undefined)}
      >
        {allLabel}
      </button>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            data-param={paramKey}
            data-value={opt.value}
            className={cn(
              'px-4 py-2 text-sm font-bold transition-colors',
              active
                ? 'bg-primary text-white'
                : 'border border-neutral-300 bg-white text-neutral-900 hover:border-neutral-900',
            )}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
