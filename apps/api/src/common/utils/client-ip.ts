import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import type { Request } from 'express';

export function extractClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return normalizeIp(forwarded.split(',')[0]?.trim() ?? '');
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return normalizeIp(forwarded[0].split(',')[0]?.trim() ?? '');
  }
  const raw = req.ip || req.socket?.remoteAddress;
  return raw ? normalizeIp(raw) : undefined;
}

/** 规范化 IPv4-mapped IPv6（::ffff:1.2.3.4 → 1.2.3.4） */
export function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  if (trimmed.startsWith('::ffff:')) {
    return trimmed.slice(7);
  }
  return trimmed;
}

export function isValidIp(ip: string): boolean {
  return isIP(normalizeIp(ip)) !== 0;
}

/** 脱敏展示（IPv4 保留前两段，IPv6 保留前两组） */
export function maskIp(ip: string): string {
  const normalized = normalizeIp(ip);
  if (isIP(normalized) === 4) {
    const parts = normalized.split('.');
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  if (isIP(normalized) === 6) {
    const parts = normalized.split(':').filter(Boolean);
    if (parts.length >= 2) return `${parts[0]}:${parts[1]}:…`;
  }
  return '…';
}

export function hashIp(ip: string, salt: string): string {
  return createHash('sha256')
    .update(`${salt}:${normalizeIp(ip)}`)
    .digest('hex')
    .slice(0, 32);
}

export function parseReferrerHost(referrer?: string | null): string | null {
  if (!referrer?.trim()) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}
