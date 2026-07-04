"use client";

import type { ComponentProps } from "react";
import { forwardRef } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "../../lib/utils";
import { buttonVariants, type ButtonProps } from "../button";

/** shadcn/ui Pagination 原语 — https://ui.shadcn.com/docs/components/pagination */
const Pagination = ({ className, ...props }: ComponentProps<"nav">) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn("mx-auto flex w-full justify-center", className)}
    {...props}
  />
);
Pagination.displayName = "Pagination";

const PaginationContent = forwardRef<HTMLUListElement, ComponentProps<"ul">>(
  ({ className, ...props }, ref) => (
    <ul
      ref={ref}
      className={cn("flex flex-row items-center gap-1", className)}
      {...props}
    />
  ),
);
PaginationContent.displayName = "PaginationContent";

const PaginationItem = forwardRef<HTMLLIElement, ComponentProps<"li">>(
  ({ className, ...props }, ref) => (
    <li ref={ref} className={cn("", className)} {...props} />
  ),
);
PaginationItem.displayName = "PaginationItem";

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<ButtonProps, "size"> &
  ComponentProps<"button">;

const PaginationLink = ({
  className,
  isActive,
  size = "icon",
  type = "button",
  ...props
}: PaginationLinkProps) => (
  <button
    type={type}
    aria-current={isActive ? "page" : undefined}
    className={cn(
      buttonVariants({
        variant: isActive ? "outline" : "ghost",
        size,
      }),
      className,
    )}
    {...props}
  />
);
PaginationLink.displayName = "PaginationLink";

const PaginationPrevious = ({
  className,
  text = "上一页",
  ...props
}: ComponentProps<typeof PaginationLink> & { text?: string }) => (
  <PaginationLink
    aria-label="上一页"
    size="default"
    className={cn("gap-1 pl-2.5", className)}
    {...props}
  >
    <ChevronLeft className="h-4 w-4" />
    <span className="hidden sm:inline">{text}</span>
  </PaginationLink>
);
PaginationPrevious.displayName = "PaginationPrevious";

const PaginationNext = ({
  className,
  text = "下一页",
  ...props
}: ComponentProps<typeof PaginationLink> & { text?: string }) => (
  <PaginationLink
    aria-label="下一页"
    size="default"
    className={cn("gap-1 pr-2.5", className)}
    {...props}
  >
    <span className="hidden sm:inline">{text}</span>
    <ChevronRight className="h-4 w-4" />
  </PaginationLink>
);
PaginationNext.displayName = "PaginationNext";

const PaginationEllipsis = ({
  className,
  ...props
}: ComponentProps<"span">) => (
  <span
    aria-hidden
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">更多页码</span>
  </span>
);
PaginationEllipsis.displayName = "PaginationEllipsis";

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};
