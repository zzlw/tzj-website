"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import { PRODUCT_LINES } from "@/lib/product-catalog";
import { PRODUCTS_HREF } from "@/lib/navigation-products";
import {
  isRelatedActive,
  isTabActive,
  resolveProductLineNav,
} from "@/lib/product-line-nav";
import { cn } from "@/lib/utils";

function findLineForPath(pathname: string, fallbackLineId: string) {
  const path =
    pathname.split("#")[0]!.split("?")[0]!.replace(/\/$/, "") || "/";
  const byPath = PRODUCT_LINES.find(
    (l) => path === l.href || (path.startsWith(`${l.href}/`) && l.href !== "/"),
  );
  if (byPath) return byPath;
  return PRODUCT_LINES.find((l) => l.id === fallbackLineId);
}

export function ProductLineNav() {
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const config = resolveProductLineNav(pathname);

  if (!config) return null;

  const line = findLineForPath(pathname ?? "", config.lineId);
  const hubHref = line?.href ?? config.tabs[0]?.href ?? "/towers";
  const showTabs = config.tabs.length > 1;
  const related = config.related ?? [];

  return (
    <nav
      aria-label={line ? tNav(line.navKey as Parameters<typeof tNav>[0]) : "产品线导航"}
      className={cn(
        "product-line-nav sticky z-40 border-b border-neutral-300 bg-white",
        "shadow-[0_1px_0_rgba(0,0,0,0.06)]",
      )}
    >
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-6 md:px-8 lg:px-12 xl:px-16">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={PRODUCTS_HREF}
            className="hidden shrink-0 text-xs font-bold uppercase tracking-wide text-secondary-text transition-colors hover:text-primary sm:inline"
          >
            {tNav("products")}
          </Link>
          <span className="hidden text-neutral-300 sm:inline" aria-hidden="true">
            /
          </span>
          <Link
            href={hubHref}
            className="flex min-w-0 items-center gap-2 transition-colors hover:text-primary"
          >
            {line ? (
              <span className="shrink-0 font-display text-sm font-extrabold text-primary">
                {String(line.index).padStart(2, "0")}
              </span>
            ) : null}
            <span className="truncate font-display text-sm font-bold text-neutral-900 md:text-base">
              {line
                ? tNav(line.navKey as Parameters<typeof tNav>[0])
                : tNav(config.tabs[0]!.key as Parameters<typeof tNav>[0])}
            </span>
          </Link>
        </div>

        {showTabs ? (
          <div
            className={cn(
              "flex gap-1 overflow-x-auto pb-0.5 md:gap-0",
              "md:rb-product-line-nav-scroll md:flex-1 md:justify-center",
            )}
            role="tablist"
          >
            {config.tabs.map((tab) => {
              const active = isTabActive(pathname ?? "", tab);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  role="tab"
                  aria-selected={active}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center whitespace-nowrap border px-3 text-sm font-bold transition-colors",
                    "border-neutral-300 bg-white text-secondary-text hover:border-neutral-900 hover:text-neutral-900",
                    "md:h-10 md:border-0 md:border-b-2 md:bg-transparent md:px-4",
                    active
                      ? "border-neutral-900 text-neutral-900 md:border-primary md:text-primary"
                      : "md:border-transparent",
                  )}
                >
                  {tNav(tab.key as Parameters<typeof tNav>[0])}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="hidden flex-1 md:block" aria-hidden="true" />
        )}

        {related.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">
            <span className="text-xs font-bold uppercase tracking-wide text-secondary-text">
              {tNav("productRelatedLines")}
            </span>
            {related.map((item) => {
              const active = isRelatedActive(pathname ?? "", item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-1 text-sm font-bold transition-colors",
                    active ? "text-primary" : "text-neutral-700 hover:text-primary",
                  )}
                >
                  {tNav(item.key as Parameters<typeof tNav>[0])}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
