// ============================================================
// TZJ — Shared Environment Variable Validation
// ============================================================
// Usage:
//   import { env } from '@tzj/config/env';
//   console.log(env.DATABASE_URL);
//
// This validates env vars at startup using Zod schemas.
// Each app can extend the base schema with its own requirements.
// ============================================================

import { z } from 'zod';

// ── Base Environment Schema (shared across all apps) ─────────
const baseEnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid URL' }),

  // Redis
  REDIS_URL: z.string().url({ message: 'REDIS_URL must be a valid URL' }),

  // Node
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// ── API-specific Schema ──────────────────────────────────────
const apiEnvSchema = baseEnvSchema.extend({
  API_PORT: z.coerce.number().default(3001),
  JWT_SECRET: z.string().min(16, { message: 'JWT_SECRET must be at least 16 characters' }),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // S3 Storage (MinIO / 阿里云 OSS)
  S3_BUCKET: z.string().default('tzj-uploads-dev'),
  S3_REGION: z.string().default('us-east-1'),
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_ACCESS_KEY_ID: z.string().default('minioadmin'),
  S3_ACCESS_KEY_SECRET: z.string().default('minioadmin'),
  S3_PUBLIC_DOMAIN: z.string().default('http://localhost:9000/tzj-uploads-dev'),
});

// ── Web-specific Schema ──────────────────────────────────────
const webEnvSchema = baseEnvSchema.extend({
  NEXT_PUBLIC_API_URL: z.string().url(),
  WEB_URL: z.string().url().default('http://localhost:3000'),
});

// ── Admin-specific Schema ────────────────────────────────────
const adminEnvSchema = baseEnvSchema.extend({
  NEXT_PUBLIC_ADMIN_API_URL: z.string().url(),
  ADMIN_URL: z.string().url().default('http://localhost:3000'),
});

// ── Exports ──────────────────────────────────────────────────
export const baseEnv = baseEnvSchema.parse(process.env);
export const apiEnv = apiEnvSchema.parse(process.env);
export const webEnv = webEnvSchema.parse(process.env);
export const adminEnv = adminEnvSchema.parse(process.env);

// Re-export schemas for extension
export { adminEnvSchema, apiEnvSchema, baseEnvSchema, webEnvSchema };

// Type exports
export type BaseEnv = z.infer<typeof baseEnvSchema>;
export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;
export type AdminEnv = z.infer<typeof adminEnvSchema>;
