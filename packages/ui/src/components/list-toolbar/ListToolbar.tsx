"use client";

import type { FormEvent, ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "../../lib/utils";
import { Card, CardContent } from "../card";
import { Input } from "../input";

export interface ListToolbarProps {
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onSearchSubmit?: () => void;
  searchPlaceholder?: string;
  /** 排序、筛选等控件 */
  children?: ReactNode;
  className?: string;
}

/** 列表页工具栏：搜索 + 右侧扩展区（排序/筛选）。 */
export function ListToolbar({
  searchValue,
  onSearchValueChange,
  onSearchSubmit,
  searchPlaceholder = "搜索…",
  children,
  className,
}: ListToolbarProps) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSearchSubmit?.();
  }

  return (
    <Card className={cn("mb-4 border-border/80 py-0 shadow-sm", className)}>
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        <form
          className="relative min-w-[220px] flex-1"
          onSubmit={handleSubmit}
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(e) => onSearchValueChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </form>
        {children}
      </CardContent>
    </Card>
  );
}
