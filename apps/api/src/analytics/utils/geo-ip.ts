export interface GeoLookup {
  country: string | null;
  region: string | null;
  city: string | null;
}

function normalizeIp(ip: string): string {
  return ip.replace(/^::ffff:/, '').trim();
}

/** 内网/回环地址判定（这些 IP 不做定位外呼） */
export function isPrivateIp(ip?: string | null): boolean {
  const value = normalizeIp(ip ?? '');
  if (!value || value === '::1' || value === '127.0.0.1' || value === 'localhost') return true;
  if (value.startsWith('10.') || value.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(value)) return true;
  return false;
}
