"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export interface ContentListItemProps {
  /** 整行跳转链接 */
  href?: string;
  /** 无障碍标签（href 存在时用于覆盖层链接） */
  linkLabel?: string;
  /** 置顶/精选等高亮样式 */
  variant?: "default" | "pinned";
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** 标题行右侧徽标（状态、置顶等） */
  badges?: ReactNode;
  /** 底部元信息（时间、作者、阅读量等） */
  meta?: ReactNode;
  /** 独立标签行（可点击筛选，需 pointer-events-auto） */
  tags?: ReactNode;
  /** 悬停显示的操作区（独立于行点击） */
  actions?: ReactNode;
  className?: string;
}

/** 知识库/内容浏览列表项（Confluence / Notion 风格单行卡片）。 */
export function ContentListItem({
  href,
  linkLabel,
  variant = "default",
  icon,
  title,
  description,
  badges,
  tags,
  meta,
  actions,
  className,
}: ContentListItemProps) {
  const clickable = Boolean(href);
  const pinned = variant === "pinned";

  return (
    <article
      className={cn(
        "group relative flex gap-3 px-4 py-4 transition-colors sm:gap-4 sm:px-5",
        pinned
          ? "border-l-4 border-l-amber-500 bg-amber-50/70 hover:bg-amber-100/60 active:bg-amber-100/80 dark:bg-amber-950/25 dark:hover:bg-amber-950/40"
          : clickable && "hover:bg-muted/40 active:bg-muted/50",
        clickable && "cursor-pointer",
        className,
      )}
    >
      {href ? (
        <a
          href={href}
          className="absolute inset-0 z-[1] rounded-none"
          aria-label={linkLabel ?? (typeof title === "string" ? title : "查看详情")}
        >
          <span className="sr-only">
            {linkLabel ?? (typeof title === "string" ? title : "查看详情")}
          </span>
        </a>
      ) : null}

      {icon ? (
        <div
          className={cn(
            "relative z-0 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
            pinned
              ? "border-amber-300/80 bg-amber-100 text-amber-700 shadow-sm dark:border-amber-700/50 dark:bg-amber-950/50 dark:text-amber-400"
              : "border-border/60 bg-muted/50 text-muted-foreground",
            clickable && "pointer-events-none",
          )}
        >
          {icon}
        </div>
      ) : null}

      <div
        className={cn(
          "relative z-0 min-w-0 flex-1",
          clickable && "pointer-events-none",
        )}
      >
        <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
          <h3
            className={cn(
              "text-base font-semibold leading-snug transition-colors",
              pinned
                ? "text-amber-950 group-hover:text-amber-800 dark:text-amber-100 dark:group-hover:text-amber-50"
                : "text-foreground group-hover:text-primary",
            )}
          >
            {title}
          </h3>
          {badges ? (
            <div className="flex flex-wrap items-center gap-1.5">{badges}</div>
          ) : null}
        </div>

        {description ? (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}

        {tags ? (
          <div
            className={cn(
              "mt-2 flex flex-wrap items-center gap-1.5",
              clickable && "pointer-events-auto relative z-[2]",
            )}
          >
            {tags}
          </div>
        ) : null}

        {meta ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {meta}
          </div>
        ) : null}
      </div>

      {actions ? (
        <div className="relative z-[2] flex shrink-0 items-start gap-0.5 pointer-events-auto">
          {actions}
        </div>
      ) : null}
    </article>
  );
}
