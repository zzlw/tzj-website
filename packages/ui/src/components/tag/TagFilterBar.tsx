"use client";

import { Tag, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../button";
import { TagChip } from "./TagChip";

export interface TagFilterItem {
  tag: string;
  count: number;
}

export interface TagFilterBarProps {
  tags: TagFilterItem[];
  activeTag?: string;
  onTagChange: (tag: string | undefined) => void;
  /** 构建标签筛选链接（SPA 导航可选） */
  buildTagHref?: (tag: string | undefined) => string;
  maxVisible?: number;
  loading?: boolean;
  className?: string;
  /** 打开标签管理（重命名、合并、删除） */
  onManageTags?: () => void;
}

/** 标签 Facet 筛选栏（Confluence / GitBook 风格）。 */
export function TagFilterBar({
  tags,
  activeTag,
  onTagChange,
  buildTagHref,
  maxVisible = 16,
  loading = false,
  className,
  onManageTags,
}: TagFilterBarProps) {
  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <Tag className="h-3.5 w-3.5" />
        加载标签…
      </div>
    );
  }

  if (!tags.length && !activeTag) return null;

  const visible = tags.slice(0, maxVisible);
  const overflow = tags.length - visible.length;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Tag className="h-3.5 w-3.5" />
          标签
        </span>
        {onManageTags ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={onManageTags}
          >
            管理
          </Button>
        ) : null}
        {activeTag ? (
          buildTagHref ? (
            <a
              href={buildTagHref(undefined)}
              className="inline-flex h-7 items-center rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="mr-1 h-3 w-3" />
              清除「{activeTag}」
            </a>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => onTagChange(undefined)}
            >
              <X className="mr-1 h-3 w-3" />
              清除「{activeTag}」
            </Button>
          )
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visible.map(({ tag, count }) => (
          <TagChip
            key={tag}
            label={tag}
            count={count}
            active={activeTag === tag}
            href={buildTagHref?.(tag)}
            onClick={(e) => {
              if (buildTagHref) return;
              e.preventDefault();
              e.stopPropagation();
              onTagChange(activeTag === tag ? undefined : tag);
            }}
          />
        ))}
        {overflow > 0 ? (
          <span className="self-center text-xs text-muted-foreground">
            +{overflow} 个标签
          </span>
        ) : null}
      </div>
    </div>
  );
}
