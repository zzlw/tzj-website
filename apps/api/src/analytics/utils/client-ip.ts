import { createHash } from "node:crypto";
import type { Request } from "express";

export function extractClientIp(req: Request): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(",")[0]?.trim();
  }
  return req.ip || req.socket?.remoteAddress || undefined;
}

export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
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
