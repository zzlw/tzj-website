'use client';

/**
 * 访客中心可复用筛选栏：全文搜索框 + 多维结构化 facet 下拉 + 活动筛选 chips。
 * 「按访客」/「按 IP」两个 lens 共用，facet 由调用方按视角配置。
 * 参考 GA4 / Leadfeeder 的「搜索 + 分面 + 一键清除」交互范式。
 */
import {
  Badge,
  Button,
  cn,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@tzj/ui';
import { Search, X } from 'lucide-react';

export interface FilterFacet {
  key: string;
  /** chip 前缀标签，如「来源」 */
  label: string;
  /** 未选中时的占位（同时作为下拉「全部」选项文案） */
  placeholder: string;
  /** 当前值（空串表示未筛选） */
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  /** 触发器宽度类，默认 w-[130px] */
  triggerClassName?: string;
}

// Radix Select 不接受空串作为 value（保留值），故用 'all' 作「全部」的占位映射。
const ALL = 'all';

function activeChips(facets: FilterFacet[]) {
  return facets
    .map((f) => {
      if (!f.value) return null;
      const opt = f.options.find((o) => o.value === f.value);
      return { facet: f, label: opt?.label ?? f.value };
    })
    .filter((x): x is { facet: FilterFacet; label: string } => x !== null);
}

export function VisitorFilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  facets,
  className,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  facets: FilterFacet[];
  className?: string;
}) {
  const chips = activeChips(facets);
  const hasActive = search.trim().length > 0 || chips.length > 0;

  const clearAll = () => {
    onSearchChange('');
    for (const f of facets) f.onChange('');
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-[240px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 pl-8 pr-8"
          />
          {search ? (
            <button
              type="button"
              aria-label="清除搜索"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {facets.map((f) => (
          <Select
            key={f.key}
            value={f.value || ALL}
            onValueChange={(v) => f.onChange(v === ALL ? '' : v)}
          >
            <SelectTrigger className={cn('h-9', f.triggerClassName ?? 'w-[130px]')}>
              <SelectValue placeholder={f.placeholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{f.placeholder}</SelectItem>
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}

        {hasActive ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-9 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            清除筛选
          </Button>
        ) : null}
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map(({ facet, label }) => (
            <Badge
              key={facet.key}
              variant="outline"
              className="gap-1 border-border bg-muted/60 font-normal text-muted-foreground"
            >
              <span className="text-foreground/60">{facet.label}:</span>
              {label}
              <button
                type="button"
                aria-label={`移除${facet.label}筛选`}
                onClick={() => facet.onChange('')}
                className="hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
