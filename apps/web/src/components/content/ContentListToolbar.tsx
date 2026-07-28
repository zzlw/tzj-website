'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@tzj/ui';
import { ChevronDown } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import type { ContentOption } from '@/lib/content-labels';
import { parseSortPreset, type SortPreset, sortPresetValue } from '@/lib/content-list';
import { cn } from '@/lib/utils';
import { ContentCategoryTabs } from './ContentCategoryTabs';

export interface ContentFilterDef {
  key: string;
  label: string;
  options: ContentOption[];
}

interface ContentListToolbarProps {
  filters?: ContentFilterDef[];
  sortOptions: SortPreset[];
  defaultSort: SortPreset;
}

/** C 端内容列表工具栏：分类 Tab + 排序（URL query 与 API 对齐）。 */
export function ContentListToolbar({
  filters = [],
  sortOptions,
  defaultSort,
}: ContentListToolbarProps) {
  const t = useTranslations('content');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [sortOpen, setSortOpen] = useState(false);

  const currentSortValue = useMemo(() => {
    const sortBy = searchParams.get('sortBy') ?? defaultSort.sortBy;
    const sortOrder = searchParams.get('sortOrder') ?? defaultSort.sortOrder;
    const matched = sortOptions.find((o) => o.sortBy === sortBy && o.sortOrder === sortOrder);
    return matched ? sortPresetValue(matched) : sortPresetValue(defaultSort);
  }, [searchParams, sortOptions, defaultSort]);

  const currentSortLabel = useMemo(() => {
    return (
      sortOptions.find((o) => sortPresetValue(o) === currentSortValue)?.label ?? defaultSort.label
    );
  }, [currentSortValue, sortOptions, defaultSort]);

  function pushParams(updates: Record<string, string | undefined>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === 'all') sp.delete(key);
      else sp.set(key, value);
    }
    const qs = sp.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  return (
    <div className="space-y-4 border border-neutral-300 bg-white p-4">
      {filters.map((filter) => {
        const current = searchParams.get(filter.key) ?? undefined;
        const active =
          current && current !== 'all' && filter.options.some((o) => o.value === current)
            ? current
            : undefined;

        return (
          <ContentCategoryTabs
            key={filter.key}
            paramKey={filter.key}
            allLabel={filter.label}
            options={filter.options}
            value={active}
            onChange={(v) => pushParams({ [filter.key]: v, page: '1' })}
          />
        );
      })}

      <div className="flex justify-end border-t border-neutral-200 pt-4">
        {/* 使用 modal={false} 的 Popover，避免 Radix Select 锁滚动导致页面宽度闪烁 */}
        <Popover open={sortOpen} onOpenChange={setSortOpen} modal={false}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={sortOpen}
              className="flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-none border border-neutral-300 bg-white px-3 text-sm text-neutral-900 shadow-sm transition-colors hover:bg-neutral-100 sm:w-[220px]"
            >
              <span className="truncate">{currentSortLabel}</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={4}
            className="w-[var(--anchor-width)] rounded-none border-neutral-300 p-1 shadow-md"
          >
            <div role="listbox" aria-label={t('sort.ariaLabel')} className="flex flex-col">
              {sortOptions.map((o) => {
                const value = sortPresetValue(o);
                const active = value === currentSortValue;
                return (
                  <button
                    key={value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={cn(
                      'flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
                      active && 'bg-accent text-accent-foreground',
                    )}
                    onClick={() => {
                      const preset = parseSortPreset(value, defaultSort);
                      pushParams({
                        sortBy: preset.sortBy,
                        sortOrder: preset.sortOrder,
                        page: '1',
                      });
                      setSortOpen(false);
                    }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
