import { isDev, isProduction } from '@tzj/env';
import { z } from 'zod';

export { isDev, isProduction };

/**
 * C 端环境变量统一入口（AGENTS.md：使用 zod 在启动时验证所有环境变量；禁止散落硬编码 URL）。
 *
 * 设计要点：
 * 1. NEXT_PUBLIC_* 由 Next 在构建期静态内联进 client bundle，必须逐个以字面量引用，
 *    不能动态遍历 process.env（动态访问在客户端拿不到值）；
 * 2. 开发环境缺失时回退本地默认值（MinIO / 本地 API），生产构建缺失直接 fail-fast，
 *    杜绝「生产静默回退 localhost」；
 * 3. 聊天服务默认与主 API 同源：NEXT_PUBLIC_CHAT_API_URL / NEXT_PUBLIC_CHAT_SOCKET_URL
 *    仅作为独立部署时的可选覆盖，未配置时从 NEXT_PUBLIC_API_URL 派生。
 */

const DEV_DEFAULTS = {
  NEXT_PUBLIC_API_URL: 'http://localhost:4000/api/v1',
  NEXT_PUBLIC_S3_PUBLIC_DOMAIN: 'http://localhost:9000/tzj-uploads-dev',
} as const;

const urlSchema = z.url();

/** 校验必填 URL：生产缺失/非法即抛错（构建期暴露），开发回退本地默认值；统一去尾斜杠。 */
function requiredUrl(name: keyof typeof DEV_DEFAULTS, value: string | undefined): string {
  if (!value) {
    if (isProduction) {
      throw new Error(`[env] 缺少必需的环境变量 ${name}（生产构建禁止回退 localhost 默认值）`);
    }
    return DEV_DEFAULTS[name];
  }
  const parsed = urlSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`[env] 环境变量 ${name} 不是合法 URL：${value}`);
  }
  return value.replace(/\/$/, '');
}

/** 校验可选 URL 覆盖项：未配置返回 undefined 交由调用方派生，配置了则必须合法。 */
function optionalUrl(name: string, value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = urlSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`[env] 环境变量 ${name} 不是合法 URL：${value}`);
  }
  return value.replace(/\/$/, '');
}

const apiUrl = requiredUrl('NEXT_PUBLIC_API_URL', process.env.NEXT_PUBLIC_API_URL);

export const env = {
  /** 主 API 基地址（含 /api/v1 前缀） */
  apiUrl,
  /** 对象存储公开访问域名（与 API S3_PUBLIC_DOMAIN 一致） */
  s3PublicDomain: requiredUrl(
    'NEXT_PUBLIC_S3_PUBLIC_DOMAIN',
    process.env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN,
  ),
  /** 聊天 REST 基地址：默认与主 API 相同，独立部署时可覆盖 */
  chatApiUrl:
    optionalUrl('NEXT_PUBLIC_CHAT_API_URL', process.env.NEXT_PUBLIC_CHAT_API_URL) ?? apiUrl,
  /** 聊天 Socket.IO 地址：默认取主 API 的 origin（不含路径），独立部署时可覆盖 */
  chatSocketUrl:
    optionalUrl('NEXT_PUBLIC_CHAT_SOCKET_URL', process.env.NEXT_PUBLIC_CHAT_SOCKET_URL) ??
    new URL(apiUrl).origin,
  /** 百度统计站点 ID（hm.js hash）兜底：优先用后台「站点设置 → 访客分析」，未配置时回退此值 */
  baiduHmId: process.env.NEXT_PUBLIC_BAIDU_HM_ID || undefined,
} as const;
