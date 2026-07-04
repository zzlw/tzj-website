import geoip from "geoip-lite";

export interface GeoLookup {
  country: string | null;
  region: string | null;
  city: string | null;
}

function normalizeIp(ip: string): string {
  return ip.replace(/^::ffff:/, "").trim();
}

function isPrivateIp(ip: string): boolean {
  if (ip === "::1" || ip === "127.0.0.1" || ip === "localhost") return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  return false;
}

/** 离线 GeoIP 解析（geoip-lite / MaxMind GeoLite）。 */
export function lookupGeo(ip?: string | null): GeoLookup {
  if (!ip?.trim()) {
    return { country: null, region: null, city: null };
  }

  const normalized = normalizeIp(ip);
  if (isPrivateIp(normalized)) {
    return { country: null, region: null, city: null };
  }

  const hit = geoip.lookup(normalized);
  if (!hit) {
    return { country: null, region: null, city: null };
  }

  return {
    country: hit.country || null,
    region: hit.region || null,
    city: hit.city || null,
  };
}
