const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const VISITOR_ID_KEY = '_tzj_vid';
// 持久匿名访客 ID：2 年（跨会话、跨日归并同一浏览器访客）
const VISITOR_ID_TTL_MS = 2 * 365 * 24 * 60 * 60 * 1000;
const SESSION_ID_KEY = '_tzj_sid';
const IDENTITY_KEY = '_tzj_identity';
const GEO_MODE_CACHE_KEY = '_tzj_geo_mode';
const GEO_MODE_CACHE_TTL_MS = 5 * 60 * 1000;
const GEO_COORDS_CACHE_KEY = '_tzj_geo_coords';
const GEO_COORDS_CACHE_TTL_MS = 30 * 60 * 1000;

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/** 持久匿名访客 ID（localStorage，2 年滚动）。同一浏览器下多次会话归并为同一访客。 */
export function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem(VISITOR_ID_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { id: string; exp: number };
      if (parsed.id && parsed.exp > Date.now()) {
        parsed.exp = Date.now() + VISITOR_ID_TTL_MS;
        localStorage.setItem(VISITOR_ID_KEY, JSON.stringify(parsed));
        return parsed.id;
      }
    }
    const id = randomId();
    localStorage.setItem(
      VISITOR_ID_KEY,
      JSON.stringify({ id, exp: Date.now() + VISITOR_ID_TTL_MS }),
    );
    return id;
  } catch {
    return randomId();
  }
}

/** 单次会话 ID（sessionStorage，关闭标签页即失效）。用于按会话聚合。 */
export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const existing = sessionStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;
    const id = randomId();
    sessionStorage.setItem(SESSION_ID_KEY, id);
    return id;
  } catch {
    return randomId();
  }
}

/** 已识别访客身份（提交询盘/登录后写入，随后续请求回传以归并）。 */
export interface VisitorIdentity {
  userId?: string;
  email?: string;
  name?: string;
  phone?: string;
  company?: string;
}

export function getStoredIdentity(): VisitorIdentity | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    return raw ? (JSON.parse(raw) as VisitorIdentity) : null;
  } catch {
    return null;
  }
}

function setStoredIdentity(identity: VisitorIdentity) {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    /* ignore */
  }
}

/**
 * identify 升级：将当前匿名访客关联到已知身份。
 * - 本地持久化身份，后续 PV 自动携带 userId
 * - 上报服务端，回写历史页面浏览并落 visitors 表
 */
export function identify(traits: VisitorIdentity): void {
  if (typeof window === 'undefined') return;
  const merged: VisitorIdentity = { ...getStoredIdentity(), ...traits };
  setStoredIdentity(merged);

  const payload = JSON.stringify({ visitorId: getVisitorId(), ...merged });
  const url = `${API_BASE}/analytics/identify`;
  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    if (navigator.sendBeacon(url, blob)) return;
  }
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {
    /* 静默失败 */
  });
}

export interface TrackPageViewInput {
  path: string;
  title?: string;
}

type GeoMode = 'ip' | 'gps';

async function getAnalyticsGeoMode(): Promise<GeoMode> {
  if (typeof window === 'undefined') return 'ip';
  try {
    const cached = sessionStorage.getItem(GEO_MODE_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as { mode: GeoMode; exp: number };
      if (parsed.mode && parsed.exp > Date.now()) return parsed.mode;
    }
    const res = await fetch(`${API_BASE}/settings/site/public`, {
      cache: 'no-store',
    });
    if (!res.ok) return 'ip';
    const json = (await res.json()) as {
      data?: { analytics?: { geoMode?: GeoMode } };
    };
    const mode = json.data?.analytics?.geoMode === 'gps' ? 'gps' : 'ip';
    sessionStorage.setItem(
      GEO_MODE_CACHE_KEY,
      JSON.stringify({ mode, exp: Date.now() + GEO_MODE_CACHE_TTL_MS }),
    );
    return mode;
  } catch {
    return 'ip';
  }
}

function readCachedCoords(): { latitude: number; longitude: number } | null {
  try {
    const raw = sessionStorage.getItem(GEO_COORDS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      latitude: number;
      longitude: number;
      exp: number;
    };
    if (
      parsed.exp > Date.now() &&
      Number.isFinite(parsed.latitude) &&
      Number.isFinite(parsed.longitude)
    ) {
      return { latitude: parsed.latitude, longitude: parsed.longitude };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeCachedCoords(latitude: number, longitude: number) {
  try {
    sessionStorage.setItem(
      GEO_COORDS_CACHE_KEY,
      JSON.stringify({
        latitude,
        longitude,
        exp: Date.now() + GEO_COORDS_CACHE_TTL_MS,
      }),
    );
  } catch {
    /* ignore */
  }
}

function getClientCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
  const cached = readCachedCoords();
  if (cached) return Promise.resolve(cached);

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        writeCachedCoords(coords.latitude, coords.longitude);
        resolve(coords);
      },
      () => resolve(null),
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 5 * 60 * 1000,
      },
    );
  });
}

/** 空闲时预取 GPS 坐标，减少首屏 PV 因等待授权而缺失地区。 */
export function prefetchClientCoordinates(): void {
  void getAnalyticsGeoMode().then((mode) => {
    if (mode === 'gps') void getClientCoordinates();
  });
}

/** 上报页面浏览（sendBeacon 优先，失败回退 fetch）。 */
export async function trackPageView(input: TrackPageViewInput): Promise<void> {
  if (typeof window === 'undefined') return;
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'false') return;

  const visitorId = getVisitorId();
  const sessionId = getSessionId();
  if (!visitorId || !sessionId) return;

  const path = input.path.trim();
  if (!path || !path.startsWith('/')) return;

  const geoMode = await getAnalyticsGeoMode();
  let latitude: number | undefined;
  let longitude: number | undefined;

  if (geoMode === 'gps') {
    const coords = await getClientCoordinates();
    if (coords) {
      latitude = coords.latitude;
      longitude = coords.longitude;
    }
  }

  const identity = getStoredIdentity();
  const payload = JSON.stringify({
    visitorId,
    sessionId,
    userId: identity?.userId ?? undefined,
    path,
    title: input.title?.slice(0, 200),
    referrer: document.referrer || undefined,
    ...(latitude != null && longitude != null ? { latitude, longitude } : {}),
  });

  const url = `${API_BASE}/analytics/collect`;

  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    if (navigator.sendBeacon(url, blob)) return;
  }

  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {
    /* 静默失败，不影响用户体验 */
  });
}
