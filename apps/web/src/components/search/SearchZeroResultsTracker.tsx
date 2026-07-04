"use client";

import { useEffect, useRef } from "react";
import { trackSearchEvent } from "@/lib/search/track-search-event";

/** 搜索结果页零结果埋点（仅上报一次）。 */
export function SearchZeroResultsTracker({ query }: { query: string }) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current || query.trim().length < 2) return;
    trackedRef.current = true;
    trackSearchEvent({ type: "zero_results", query: query.trim(), resultCount: 0 });
  }, [query]);

  return null;
}
