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
 * 高德逆地理编码（国内生产主方案）。
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

/** 境外或高德不可用时的兜底（开发/海外访客）。 */
async function fetchBigDataCloud(latitude: number, longitude: number): Promise<GeoLookup | null> {
  const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('localityLanguage', 'zh');

  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    countryCode?: string;
    principalSubdivision?: string;
    city?: string;
    locality?: string;
  };
  const geo: GeoLookup = {
    country: data.countryCode?.toUpperCase() ?? null,
    region: data.principalSubdivision ?? null,
    city: data.city ?? data.locality ?? null,
  };
  return hasGeo(geo) ? geo : null;
}

/** GPS 逆地理编码（高德优先，失败回退 BigDataCloud，带内存缓存）。 */
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

  const providers: Array<() => Promise<GeoLookup | null>> = [];
  const trimmedKey = amapKey?.trim();
  if (trimmedKey) {
    providers.push(() => fetchAmap(latitude, longitude, trimmedKey));
  }
  providers.push(() => fetchBigDataCloud(latitude, longitude));

  for (const provider of providers) {
    try {
      const geo = await provider();
      if (geo) {
        cache.set(key, { geo, exp: Date.now() + CACHE_TTL_MS });
        return geo;
      }
    } catch {
      /* 尝试下一个提供商 */
    }
  }

  return { country: null, region: null, city: null };
}
