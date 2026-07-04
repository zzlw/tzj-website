"use client";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  PRODUCT_LINE_COUNT,
  PRODUCT_NAV_GROUPS,
  PRODUCTS_HREF,
} from "@/lib/navigation-products";
import type { ProductLine } from "@/lib/product-catalog";

type NavLabel = (key: string) => string;

function ProductLineLink({
  line,
  label,
  onNavigate,
}: {
  line: ProductLine;
  label: NavLabel;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={line.href}
      onClick={onNavigate}
      className="group flex items-start gap-2 py-2 transition-colors hover:text-primary"
    >
      <span className="mt-0.5 shrink-0 font-display text-xs font-extrabold text-primary">
        {String(line.index).padStart(2, "0")}
      </span>
      <span className="font-display text-[15px] font-bold leading-snug text-neutral-900 group-hover:text-primary">
        {label(line.navKey)}
      </span>
    </Link>
  );
}

export function ProductMegaMenu({
  title,
  browseAllLabel,
  label,
  onNavigate,
}: {
  title: string;
  browseAllLabel: string;
  label: NavLabel;
  onNavigate: () => void;
}) {
  const tHeader = useTranslations("header");

  return (
    <div className="rb-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-8 pb-10 pt-6 lg:px-10 lg:pt-24">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-neutral-900">{title}</h2>
          <p className="mt-1 text-sm text-secondary-text">
            {tHeader("productMegaStructure", { count: PRODUCT_LINE_COUNT })}
          </p>
        </div>
        <Link
          href={PRODUCTS_HREF}
          onClick={onNavigate}
          className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary transition-colors hover:text-primary-hover"
        >
          {browseAllLabel}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-10 xl:grid-cols-4">
        {PRODUCT_NAV_GROUPS.map(({ family, lines, groupIndex, familyHref }) => (
          <section key={family.id} aria-labelledby={`mega-family-${family.id}`}>
            <Link
              id={`mega-family-${family.id}`}
              href={familyHref}
              onClick={onNavigate}
              className="group block border-l-4 border-primary pl-3 transition-colors hover:border-neutral-900"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                {tHeader("productFamilyIndex", { index: groupIndex + 1, total: 4 })}
              </p>
              <h3 className="mt-1 font-display text-base font-extrabold text-neutral-900 group-hover:text-primary">
                {label(family.navKey)}
              </h3>
              <p className="mt-0.5 text-xs font-bold text-secondary-text">
                {tHeader("productLineCount", { count: lines.length })}
              </p>
            </Link>
            <ul className="mt-4 flex flex-col">
              {lines.map((line) => (
                <li key={line.id}>
                  <ProductLineLink line={line} label={label} onNavigate={onNavigate} />
                  {line.subLinks ? (
                    <ul className="mb-2 ml-5 flex flex-col border-l border-neutral-200">
                      {line.subLinks.map((sub) => (
                        <li key={sub.href}>
                          <Link
                            href={sub.href}
                            onClick={onNavigate}
                            className="block py-1.5 pl-3 text-sm font-semibold text-secondary-text transition-colors hover:text-primary"
                          >
                            {sub.navKey ? label(sub.navKey) : sub.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export function ProductMobileAccordion({
  title,
  browseAllLabel,
  label,
  onNavigate,
}: {
  title: string;
  browseAllLabel: string;
  label: NavLabel;
  onNavigate: () => void;
}) {
  const tHeader = useTranslations("header");

  return (
    <nav className="px-6 py-4" aria-label={title}>
      <div className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-4">
        <h2 className="font-display text-lg font-extrabold text-neutral-900">{title}</h2>
        <Link
          href={PRODUCTS_HREF}
          onClick={onNavigate}
          className="shrink-0 text-sm font-bold text-primary"
        >
          {browseAllLabel}
        </Link>
      </div>

      <div className="mt-2 flex flex-col divide-y divide-neutral-200">
        {PRODUCT_NAV_GROUPS.map(({ family, lines, groupIndex, familyHref }) => (
          <details key={family.id} className="group py-1">
            <summary className="flex cursor-pointer list-none items-center justify-between py-4 marker:content-none">
              <div className="min-w-0 pr-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                  {tHeader("productFamilyIndexShort", {
                    index: groupIndex + 1,
                    total: 4,
                    count: lines.length,
                  })}
                </p>
                <span className="font-display text-base font-bold text-neutral-900">
                  {label(family.navKey)}
                </span>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 rotate-90 text-neutral-400 transition-transform group-open:rotate-[135deg]" />
            </summary>
            <div className="pb-4 pl-1">
              <Link
                href={familyHref}
                onClick={onNavigate}
                className="mb-3 inline-block text-xs font-bold text-primary"
              >
                {tHeader("productViewFamily")}
              </Link>
              <ul className="flex flex-col">
                {lines.map((line) => (
                  <li key={line.id}>
                    <ProductLineLink line={line} label={label} onNavigate={onNavigate} />
                    {line.subLinks ? (
                      <ul className="mb-2 ml-5 border-l border-neutral-200">
                        {line.subLinks.map((sub) => (
                          <li key={sub.href}>
                            <Link
                              href={sub.href}
                              onClick={onNavigate}
                              className="block py-1.5 pl-3 text-sm text-secondary-text transition-colors hover:text-primary"
                            >
                              {sub.navKey ? label(sub.navKey) : sub.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        ))}
      </div>
    </nav>
  );
}
