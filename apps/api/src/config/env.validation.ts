import { z } from 'zod';

/**
 * API 运行时环境变量校验。
 * 在 ConfigModule 加载 .env 之后执行，缺失/非法直接 fail-fast。
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(3001),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().optional(),

  // Auth
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  // CORS 白名单（逗号分隔）
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:3001,http://localhost:3002'),

  // 限流
  THROTTLE_TTL: z.coerce.number().default(60),
  THROTTLE_LIMIT: z.coerce.number().default(120),

  // S3 / OSS
  S3_BUCKET: z.string().default('tzj-uploads-dev'),
  S3_REGION: z.string().default('us-east-1'),
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_ACCESS_KEY_ID: z.string().default('minioadmin'),
  S3_ACCESS_KEY_SECRET: z.string().default('minioadmin'),
  S3_PUBLIC_DOMAIN: z.string().default('http://localhost:9000/tzj-uploads-dev'),

  // Analytics
  /** 高德 Web 服务 Key — GPS 逆地理（优先读后台集成凭证，env 兜底） */
  AMAP_WEB_KEY: z.string().optional(),
  /** 加密 integration secrets（至少 32 字符，生产务必配置） */
  SECRETS_ENCRYPTION_KEY: z.string().optional(),
  ALIYUN_CAPTCHA_ACCESS_KEY_ID: z.string().optional(),
  ALIYUN_CAPTCHA_ACCESS_KEY_SECRET: z.string().optional(),
  ALIYUN_CAPTCHA_REGION: z.string().optional(),
  ANALYTICS_IP_SALT: z.string().optional(),
});

export type ApiEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): ApiEnv {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`❌ 环境变量校验失败:\n${issues}`);
  }
  return parsed.data;
}
