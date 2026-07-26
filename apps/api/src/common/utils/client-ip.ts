import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import type { Request } from 'express';

/** IPv4 私有段 / 回环 / 链路本地 */
const PRIVATE_IPV4_RE = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/;

/**
 * 判断直连方是否为受信代理（BFF / 反代）。
 * 默认信任回环与私有网段（BFF 与 API 同机/同内网部署），
 * 可通过 TRUSTED_PROXY_IPS（逗号分隔）追加。
 * 公网直连请求伪造的 X-Forwarded-For 因此不被采信。
 */
export function isTrustedProxyIp(ip: string | undefined): boolean {
  if (!ip) return false;
  const n = normalizeIp(ip);
  if (n === '::1') return true;
  const extra = (process.env.TRUSTED_PROXY_IPS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (extra.includes(n)) return true;
  const family = isIP(n);
  if (family === 4) return PRIVATE_IPV4_RE.test(n);
  if (family === 6) return /^(fc|fd|fe80)/i.test(n);
  return false;
}

/**
 * 提取真实客户端 IP（防伪造口径）：
 * 仅当直连方是受信代理（BFF/反代）时才采信 X-Forwarded-For 首段，
 * 否则一律回退 socket 地址——否则公网请求可伪造 XFF 绕过 IP 封禁、污染审计源 IP。
 * AuditLog / IpBanGuard / Throttler / 2FA 限流均以本函数为唯一口径。
 */
export function extractClientIp(req: Request): string | undefined {
  const remote = req.socket?.remoteAddress ? normalizeIp(req.socket.remoteAddress) : undefined;
  const forwarded = req.headers['x-forwarded-for'];
  const raw = typeof forwarded === 'string' ? forwarded : Array.isArray(forwarded) ? forwarded[0] : undefined;
  if (raw?.trim() && isTrustedProxyIp(remote)) {
    const candidate = normalizeIp(raw.split(',')[0]?.trim() ?? '');
    if (isValidIp(candidate)) return candidate;
  }
  if (remote) return remote;
  return req.ip ? normalizeIp(req.ip) : undefined;
}

/**
 * 从 Socket.IO 握手信息中提取客户端 IP（与 extractClientIp 同口径：
 * 仅受信代理直连时才采信 x-forwarded-for）。用于 WS 入口的 IP 封禁校验。
 */
export function extractSocketIp(handshake: {
  headers?: Record<string, string | string[] | undefined>;
  address?: string;
}): string | undefined {
  const remote = handshake.address ? normalizeIp(handshake.address) : undefined;
  const forwarded = handshake.headers?.['x-forwarded-for'];
  const raw = typeof forwarded === 'string' ? forwarded : Array.isArray(forwarded) ? forwarded[0] : undefined;
  if (raw?.trim() && isTrustedProxyIp(remote)) {
    const candidate = normalizeIp(raw.split(',')[0]?.trim() ?? '');
    if (isValidIp(candidate)) return candidate;
  }
  return remote;
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
