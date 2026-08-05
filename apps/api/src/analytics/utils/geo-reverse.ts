import type { GeoLookup } from './geo-ip';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;
const cache = new Map<string, { geo: GeoLookup; exp: number }>();

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

function hasGeo(geo: GeoLookup): boolean {
  return Boolean(geo.country || geo.region || geo.city);
}

function normalizeAmapCity(city: string | string[] | undefined): string | null {
  if (!city) return null;
  if (Array.isArray(city)) {
    const first = city[0]?.trim();
    return first || null;
  }
  const value = city.trim();
  if (!value || value === '[]') return null;
  return value;
}

/**
 * 高德逆地理编码（GPS 定位唯一来源）。
 * 浏览器 Geolocation 为 WGS84，需传 coordsys=gps。
 * @see https://lbs.amap.com/api/webservice/guide/api/georegeo
 */
async function fetchAmap(
  latitude: number,
  longitude: number,
  apiKey: string,
): Promise<GeoLookup | null> {
  const url = new URL('https://restapi.amap.com/v3/geocode/regeo');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('location', `${longitude},${latitude}`);
  url.searchParams.set('coordsys', 'gps');
  url.searchParams.set('extensions', 'base');
  url.searchParams.set('output', 'JSON');

  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    status?: string;
    regeocode?: {
      addressComponent?: {
        province?: string;
        city?: string | string[];
        district?: string;
      };
    };
  };
  if (data.status !== '1') return null;

  const comp = data.regeocode?.addressComponent;
  if (!comp) return null;

  const region = comp.province?.trim() || null;
  const city = normalizeAmapCity(comp.city) || comp.district?.trim() || region;

  const geo: GeoLookup = {
    country: 'CN',
    region,
    city,
  };
  return hasGeo(geo) ? geo : null;
}

/**
 * GPS 逆地理编码（仅高德，带内存缓存）。
 * 高德 Key 未配置或请求失败时返回空结果；上层采集链路会回退到 IP 定位。
 */
export async function lookupGeoFromCoordinates(
  latitude: number,
  longitude: number,
  amapKey?: string | null,
): Promise<GeoLookup> {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return { country: null, region: null, city: null };
  }

  const key = cacheKey(latitude, longitude);
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.geo;

  const trimmedKey = amapKey?.trim();
  if (!trimmedKey) return { country: null, region: null, city: null };

  try {
    const geo = await fetchAmap(latitude, longitude, trimmedKey);
    if (geo) {
      cache.set(key, { geo, exp: Date.now() + CACHE_TTL_MS });
      return geo;
    }
  } catch {
    /* 高德失败返回空结果 */
  }

  return { country: null, region: null, city: null };
}
