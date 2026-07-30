import { env } from './env';

const API_BASE = env.apiUrl;

const VISITOR_ID_KEY = '_tzj_vid';
// 持久匿名访客 ID：2 年（跨会话、跨日归并同一浏览器访客）
const VISITOR_ID_TTL_MS = 2 * 365 * 24 * 60 * 60 * 1000;
const SESSION_ID_KEY = '_tzj_sid';
const IDENTITY_KEY = '_tzj_identity';
// 会话首触营销归因（sessionStorage，首次带参访问时锁定）
const SESSION_ATTRIBUTION_KEY = '_tzj_attr';
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

/** 会话首触营销归因（UTM 五参数 + gclid/bd_vid 广告点击 ID）。 */
interface SessionAttribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  gclid?: string;
  bdVid?: string;
}

function parseAttributionFromUrl(): SessionAttribution {
  const params = new URLSearchParams(window.location.search);
  const pick = (k: string) => params.get(k)?.slice(0, 200) || undefined;
  const attr: SessionAttribution = {
    utmSource: pick('utm_source'),
    utmMedium: pick('utm_medium'),
    utmCampaign: pick('utm_campaign'),
    utmContent: pick('utm_content'),
    utmTerm: pick('utm_term'),
    gclid: params.get('gclid')?.slice(0, 512) || undefined,
    // 百度 OCPC 点击 ID（开启 OCPC 后百度自动追加，转化回传必须携带）
    bdVid: params.get('bd_vid')?.slice(0, 512) || undefined,
  };
  // 剔除全空键，便于判断“本次 URL 是否携带归因”
  for (const key of Object.keys(attr) as Array<keyof SessionAttribution>) {
    if (attr[key] == null) delete attr[key];
  }
  return attr;
}

/**
 * 读取会话首触归因：首次带 UTM/gclid 访问时写入 sessionStorage 并锁定，
 * 后续无参 PV 仍回传会话的原始渠道（业内“渠道归属到会话”惯例）。
 * 无归因时返回空对象（便于直接展开、不抬高调用处复杂度）。
 */
function getSessionAttribution(): SessionAttribution {
  if (typeof window === 'undefined') return {};
  try {
    const stored = sessionStorage.getItem(SESSION_ATTRIBUTION_KEY);
    if (stored) return JSON.parse(stored) as SessionAttribution;
    const fresh = parseAttributionFromUrl();
    if (Object.keys(fresh).length === 0) return {};
    sessionStorage.setItem(SESSION_ATTRIBUTION_KEY, JSON.stringify(fresh));
    return fresh;
  } catch {
    return {};
  }
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
  const attribution = getSessionAttribution();
  const payload = JSON.stringify({
    visitorId,
    sessionId,
    userId: identity?.userId ?? undefined,
    path,
    title: input.title?.slice(0, 200),
    referrer: document.referrer || undefined,
    ...(latitude != null && longitude != null ? { latitude, longitude } : {}),
    ...attribution,
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
