"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { Clock, Loader2, Search, TrendingUp, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { getPopularSearches } from "@/lib/search/popular-queries";
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
} from "@/lib/search/recent-searches";
import { trackSearchEvent } from "@/lib/search/track-search-event";
import type { SearchResult } from "@/lib/search/types";
import type { AppLocale } from "@/i18n/routing";

type SearchBarProps = {
  defaultQuery?: string;
  className?: string;
  onSubmitted?: () => void;
  autoFocus?: boolean;
  size?: "default" | "large";
  /** overlay：全屏遮罩；inline：结果页内嵌 */
  variant?: "overlay" | "inline";
};

type PanelItem =
  | { kind: "query"; query: string }
  | { kind: "recent"; query: string }
  | { kind: "popular"; query: string }
  | { kind: "entity"; result: SearchResult };

type PanelMode = "idle" | "loading" | "suggestions" | "query-only" | "empty" | "guides";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <strong className="font-bold text-neutral-900">{text.slice(idx, idx + query.length)}</strong>
      {text.slice(idx + query.length)}
    </>
  );
}

/** 联想下拉：加载态、空态、最近/热门搜索、类型标签（业内最佳实践） */
export function SearchBar({
  defaultQuery = "",
  className,
  onSubmitted,
  autoFocus = false,
  size = "default",
  variant = "overlay",
}: SearchBarProps) {
  const t = useTranslations("search");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const inputId = useId();
  const listboxId = useId();
  const liveId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState(defaultQuery);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [liveMessage, setLiveMessage] = useState("");
  const [, startTransition] = useTransition();
  const debouncedQuery = useDebouncedValue(query, 200);
  const abortRef = useRef<AbortController | null>(null);
  const suggestCacheRef = useRef(new Map<string, SearchResult[]>());

  const isLarge = size === "large";
  const trimmedQuery = query.trim();
  const popularSearches = useMemo(() => getPopularSearches(locale), [locale]);

  const goToSearch = useCallback(
    (q: string, source: "search_submit" | "recent_click" | "popular_click" = "search_submit") => {
      const trimmed = q.trim();
      if (trimmed.length < 2) return;
      addRecentSearch(trimmed);
      setRecentSearches(getRecentSearches());
      trackSearchEvent({ type: source, query: trimmed });
      setOpen(false);
      onSubmitted?.();
      startTransition(() => {
        router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      });
    },
    [onSubmitted, router, startTransition],
  );

  const goToEntity = useCallback(
    (item: SearchResult) => {
      const label = item.title.trim();
      if (label.length >= 2) {
        addRecentSearch(label);
        setRecentSearches(getRecentSearches());
      }
      trackSearchEvent({
        type: "suggest_click",
        query: trimmedQuery,
        suggestion: item.title,
        group: item.group,
      });
      setOpen(false);
      onSubmitted?.();
      startTransition(() => {
        router.push(item.href);
      });
    },
    [onSubmitted, router, startTransition, trimmedQuery],
  );

  const panelMode: PanelMode = useMemo(() => {
    if (!open) return "idle";
    if (trimmedQuery.length < 1) return "guides";
    if (isLoading) return "loading";
    if (suggestions.length > 0) return "suggestions";
    if (trimmedQuery.length >= 2) return "query-only";
    return "empty";
  }, [open, trimmedQuery, isLoading, suggestions.length]);

  const panelItems: PanelItem[] = useMemo(() => {
    if (panelMode === "guides") {
      return [
        ...recentSearches.map((q) => ({ kind: "recent" as const, query: q })),
        ...popularSearches
          .filter((q) => !recentSearches.includes(q))
          .map((q) => ({ kind: "popular" as const, query: q })),
      ];
    }
    if (panelMode === "suggestions" || panelMode === "query-only") {
      const items: PanelItem[] = [];
      if (trimmedQuery.length >= 2) {
        items.push({ kind: "query", query: trimmedQuery });
      }
      if (panelMode === "suggestions") {
        items.push(...suggestions.map((result) => ({ kind: "entity" as const, result })));
      }
      return items;
    }
    return [];
  }, [panelMode, recentSearches, popularSearches, suggestions, trimmedQuery]);

  const showPanel = open && panelMode !== "idle";

  useEffect(() => {
    setQuery(defaultQuery);
  }, [defaultQuery]);

  useEffect(() => {
    if (!open) return;
    setRecentSearches(getRecentSearches());
  }, [open]);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 1) {
      setSuggestions([]);
      setActiveIndex(-1);
      setIsLoading(false);
      abortRef.current?.abort();
      return;
    }

    const cacheKey = `${locale}:${q}`;
    const cached = suggestCacheRef.current.get(cacheKey);
    if (cached) {
      setSuggestions(cached);
      setActiveIndex(-1);
      setIsLoading(false);
      setLiveMessage(t("suggestionsCount", { count: cached.length }));
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);

    fetch(`/api/search/suggest?q=${encodeURIComponent(q)}&locale=${locale}`, {
      signal: controller.signal,
    })
      .then((res) => res.json() as Promise<{ suggestions: SearchResult[] }>)
      .then((data) => {
        if (controller.signal.aborted) return;
        const next = data.suggestions ?? [];
        suggestCacheRef.current.set(cacheKey, next);
        if (suggestCacheRef.current.size > 50) {
          const firstKey = suggestCacheRef.current.keys().next().value;
          if (firstKey) suggestCacheRef.current.delete(firstKey);
        }
        setSuggestions(next);
        setActiveIndex(-1);
        setIsLoading(false);
        setLiveMessage(
          next.length > 0 ? t("suggestionsCount", { count: next.length }) : t("noSuggestions"),
        );
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSuggestions([]);
        setIsLoading(false);
        setLiveMessage(t("noSuggestions"));
      });
  }, [debouncedQuery, locale, t]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const selectPanelItem = useCallback(
    (item: PanelItem) => {
      if (item.kind === "entity") {
        goToEntity(item.result);
        return;
      }
      if (item.kind === "query") {
        goToSearch(item.query);
        return;
      }
      goToSearch(item.query, item.kind === "recent" ? "recent_click" : "popular_click");
    },
    [goToEntity, goToSearch],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activeIndex >= 0 && panelItems[activeIndex]) {
      selectPanelItem(panelItems[activeIndex]!);
      return;
    }
    goToSearch(query);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Tab") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (!showPanel) return;

    if (e.key === "ArrowDown") {
      if (panelItems.length === 0) return;
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % panelItems.length);
    } else if (e.key === "ArrowUp") {
      if (panelItems.length === 0) return;
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? panelItems.length - 1 : i - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  function handleClearRecent() {
    clearRecentSearches();
    setRecentSearches([]);
  }

  let panelIndex = -1;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <form
        onSubmit={handleSubmit}
        className={cn(
          "flex overflow-hidden bg-white",
          variant === "overlay" ? "shadow-xl" : "border border-neutral-300",
        )}
        role="search"
      >
        <div className="relative flex min-w-0 flex-1 items-center">
          <label htmlFor={inputId} className="sr-only">
            {t("placeholder")}
          </label>
          <input
            ref={inputRef}
            id={inputId}
            name="q"
            type="text"
            inputMode="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            autoFocus={autoFocus}
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={t("placeholder")}
            role="combobox"
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-expanded={showPanel}
            aria-busy={isLoading}
            aria-controls={showPanel ? listboxId : undefined}
            aria-describedby={liveId}
            aria-activedescendant={
              showPanel && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
            }
            className={cn(
              "search-input-no-native-clear w-full bg-transparent text-neutral-900 placeholder:text-neutral-500 focus:outline-none",
              isLarge
                ? "px-5 py-4 pr-10 text-base md:px-6 md:py-5 md:text-lg"
                : "px-4 py-3 pr-9 text-sm md:text-base",
            )}
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSuggestions([]);
                setActiveIndex(-1);
                inputRef.current?.focus();
              }}
              className="absolute right-2 flex h-8 w-8 items-center justify-center text-neutral-400 transition-colors hover:text-neutral-900"
              aria-label={t("clear")}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <button
          type="submit"
          className={cn(
            "flex shrink-0 items-center justify-center bg-primary text-white transition-colors hover:bg-primary-hover",
            isLarge ? "px-5 md:px-6" : "px-4",
          )}
          aria-label={t("submit")}
        >
          <Search className={isLarge ? "h-5 w-5" : "h-4 w-4"} strokeWidth={2.25} aria-hidden="true" />
        </button>
      </form>

      <p id={liveId} className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </p>

      {showPanel ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={t("suggestionsLabel")}
          className="absolute left-0 right-0 top-full z-20 max-h-80 overflow-y-auto border border-t-0 border-neutral-300 bg-neutral-100 shadow-lg"
        >
          {panelMode === "loading" ? (
            <div className="flex items-center gap-3 px-5 py-4 text-sm text-neutral-600 md:px-6">
              <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
              {t("loading")}
            </div>
          ) : null}

          {panelMode === "empty" ? (
            <div className="px-5 py-4 text-sm text-neutral-600 md:px-6">{t("minLength")}</div>
          ) : null}

          {panelMode === "guides" ? (
            <>
              {recentSearches.length > 0 ? (
                <div className="border-b border-neutral-200/80">
                  <div className="flex items-center justify-between px-5 pb-1 pt-3 md:px-6">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {t("recentSearches")}
                    </p>
                    <button
                      type="button"
                      onClick={handleClearRecent}
                      className="text-[10px] font-bold uppercase tracking-wide text-neutral-500 transition-colors hover:text-primary"
                    >
                      {t("clearRecent")}
                    </button>
                  </div>
                  {recentSearches.map((item) => {
                    panelIndex += 1;
                    const index = panelIndex;
                    const active = index === activeIndex;
                    return (
                      <div key={`recent-${item}`} role="presentation">
                        <button
                          type="button"
                          id={`${listboxId}-option-${index}`}
                          role="option"
                          aria-selected={active}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => goToSearch(item, "recent_click")}
                          className={cn(
                            "flex w-full px-5 py-3 text-left text-sm transition-colors md:px-6 md:text-base",
                            active ? "bg-white text-primary" : "text-neutral-800 hover:bg-white hover:text-primary",
                          )}
                        >
                          {item}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <div>
                <p className="flex items-center gap-1.5 px-5 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500 md:px-6">
                  <TrendingUp className="h-3 w-3" aria-hidden="true" />
                  {t("popularSearches")}
                </p>
                {popularSearches
                  .filter((item) => !recentSearches.includes(item))
                  .map((item) => {
                    panelIndex += 1;
                    const index = panelIndex;
                    const active = index === activeIndex;
                    return (
                      <div key={`popular-${item}`} role="presentation">
                        <button
                          type="button"
                          id={`${listboxId}-option-${index}`}
                          role="option"
                          aria-selected={active}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => goToSearch(item, "popular_click")}
                          className={cn(
                            "flex w-full px-5 py-3 text-left text-sm transition-colors md:px-6 md:text-base",
                            active ? "bg-white text-primary" : "text-neutral-800 hover:bg-white hover:text-primary",
                          )}
                        >
                          {item}
                        </button>
                      </div>
                    );
                  })}
              </div>
            </>
          ) : null}

          {panelMode === "suggestions" || panelMode === "query-only"
            ? panelItems.map((item, index) => {
                const active = index === activeIndex;
                if (item.kind === "query") {
                  return (
                    <div key="search-query" role="presentation">
                      <button
                        type="button"
                        id={`${listboxId}-option-${index}`}
                        role="option"
                        aria-selected={active}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => goToSearch(item.query)}
                        className={cn(
                          "flex w-full items-center gap-3 border-b border-neutral-200/80 px-5 py-3.5 text-left transition-colors md:px-6",
                          active ? "bg-white text-primary" : "text-neutral-800 hover:bg-white hover:text-primary",
                        )}
                      >
                        <Search className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        <span className="text-sm font-medium md:text-base">
                          {t("searchForQuery", { query: item.query })}
                        </span>
                      </button>
                    </div>
                  );
                }

                const entity = item.result;
                return (
                  <div key={entity.id} role="presentation">
                    <button
                      type="button"
                      id={`${listboxId}-option-${index}`}
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => goToEntity(entity)}
                      className={cn(
                        "flex w-full flex-col gap-1 border-b border-neutral-200/80 px-5 py-3 text-left transition-colors last:border-b-0 md:px-6",
                        active ? "bg-white" : "hover:bg-white",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold leading-none tracking-wide",
                            active
                              ? "bg-primary/10 text-primary"
                              : "bg-neutral-200 text-neutral-600",
                          )}
                        >
                          {t(`groups.${entity.group}`)}
                        </span>
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-sm md:text-base",
                            active ? "font-medium text-primary" : "text-neutral-800",
                          )}
                        >
                          <HighlightMatch text={entity.title} query={trimmedQuery} />
                        </span>
                      </span>
                      {entity.excerpt ? (
                        <span className="line-clamp-1 text-xs text-neutral-500 md:text-sm">
                          {entity.excerpt}
                        </span>
                      ) : null}
                    </button>
                  </div>
                );
              })
            : null}
        </div>
      ) : null}
    </div>
  );
}
