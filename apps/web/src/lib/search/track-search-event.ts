import { getVisitorSessionId } from "@/lib/analytics";

export type SearchEventType = "search_submit" | "suggest_click" | "recent_click" | "popular_click" | "zero_results";

export interface SearchEventPayload {
  type: SearchEventType;
  query: string;
  suggestion?: string;
  group?: string;
  resultCount?: number;
}

/** 上报搜索交互事件（sendBeacon 优先，失败静默）。 */
export function trackSearchEvent(payload: SearchEventPayload): void {
  if (typeof window === "undefined") return;
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "false") return;

  const sessionId = getVisitorSessionId();
  if (!sessionId) return;

  const body = JSON.stringify({
    sessionId,
    ...payload,
    ts: Date.now(),
  });

  const url = "/api/search/analytics";

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon(url, blob)) return;
  }

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    /* 静默失败 */
  });
}
