"use client";

import type { MouseEvent, ReactNode } from "react";
import { badgeVariants } from "../badge";
import { cn } from "../../lib/utils";

export interface TagChipProps {
  label: string;
  count?: number;
  active?: boolean;
  icon?: ReactNode;
  href?: string;
  onClick?: (event: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  className?: string;
}

/** 可点击标签 Chip（筛选、导航）。 */
export function TagChip({
  label,
  count,
  active = false,
  icon,
  href,
  onClick,
  className,
}: TagChipProps) {
  const classes = cn(
    badgeVariants({ variant: active ? "default" : "outline" }),
    "cursor-pointer gap-1 font-normal",
    !active && "border-border/80 bg-background hover:border-primary/40 hover:bg-muted/60",
    className,
  );

  const content = (
    <>
      {icon}
      <span>{label}</span>
      {count != null ? (
        <span
          className={cn(
            "ml-0.5 tabular-nums",
            active ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {count}
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <a href={href} className={classes} onClick={onClick}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" className={classes} onClick={onClick}>
      {content}
    </button>
  );
}
