const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

const SESSION_KEY = "_tzj_sid";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/** 匿名访客会话 ID（localStorage，30 天滚动）。 */
export function getVisitorSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { id: string; exp: number };
      if (parsed.id && parsed.exp > Date.now()) {
        parsed.exp = Date.now() + SESSION_TTL_MS;
        localStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
        return parsed.id;
      }
    }
    const id = randomId();
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ id, exp: Date.now() + SESSION_TTL_MS }),
    );
    return id;
  } catch {
    return randomId();
  }
}

export interface TrackPageViewInput {
  path: string;
  title?: string;
}

/** 上报页面浏览（sendBeacon 优先，失败回退 fetch）。 */
export function trackPageView(input: TrackPageViewInput): void {
  if (typeof window === "undefined") return;
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "false") return;

  const sessionId = getVisitorSessionId();
  if (!sessionId) return;

  const path = input.path.trim();
  if (!path || !path.startsWith("/")) return;

  const payload = JSON.stringify({
    sessionId,
    path,
    title: input.title?.slice(0, 200),
    referrer: document.referrer || undefined,
  });

  const url = `${API_BASE}/analytics/collect`;

  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon(url, blob)) return;
  }

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    /* 静默失败，不影响用户体验 */
  });
}
