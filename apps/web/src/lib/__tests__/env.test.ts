import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * env.ts 在模块加载期完成校验，测试须每次 resetModules 后动态 import 取新副本。
 * vi.stubEnv 保证用例间环境变量互不污染。
 */
async function importEnv() {
  const mod = await import('@/lib/env');
  return mod.env;
}

beforeEach(() => {
  vi.resetModules();
  // 清空可能来自 shell/.env 的注入，保证用例从干净状态出发
  vi.stubEnv('NEXT_PUBLIC_API_URL', '');
  vi.stubEnv('NEXT_PUBLIC_S3_PUBLIC_DOMAIN', '');
  vi.stubEnv('NEXT_PUBLIC_CHAT_API_URL', '');
  vi.stubEnv('NEXT_PUBLIC_CHAT_SOCKET_URL', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('开发/测试环境（非 production）', () => {
  it('缺失必填变量时回退本地默认值', async () => {
    const env = await importEnv();
    expect(env.apiUrl).toBe('http://localhost:4000/api/v1');
    expect(env.s3PublicDomain).toBe('http://localhost:9000/tzj-uploads-dev');
  });

  it('chat 未覆盖时从主 API 派生：REST 同址、Socket 取 origin', async () => {
    const env = await importEnv();
    expect(env.chatApiUrl).toBe(env.apiUrl);
    expect(env.chatSocketUrl).toBe('http://localhost:4000');
  });

  it('显式配置时使用配置值并去尾斜杠', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com/api/v1/');
    vi.stubEnv('NEXT_PUBLIC_CHAT_SOCKET_URL', 'https://chat.example.com/');
    const env = await importEnv();
    expect(env.apiUrl).toBe('https://api.example.com/api/v1');
    expect(env.chatSocketUrl).toBe('https://chat.example.com');
  });

  it('非法 URL 直接抛错（不静默容忍）', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'not-a-url');
    await expect(importEnv()).rejects.toThrow(/不是合法 URL/);
  });
});

describe('生产环境 fail-fast', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
  });

  it('缺失 NEXT_PUBLIC_API_URL 时构建期抛错，禁止回退 localhost', async () => {
    await expect(importEnv()).rejects.toThrow(/缺少必需的环境变量 NEXT_PUBLIC_API_URL/);
  });

  it('缺失 S3 域名同样抛错', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.tzjii.com/api/v1');
    await expect(importEnv()).rejects.toThrow(/缺少必需的环境变量 NEXT_PUBLIC_S3_PUBLIC_DOMAIN/);
  });

  it('配置齐全时正常导出', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.tzjii.com/api/v1');
    vi.stubEnv('NEXT_PUBLIC_S3_PUBLIC_DOMAIN', 'https://oss.tzjii.com/tzj-uploads');
    const env = await importEnv();
    expect(env.apiUrl).toBe('https://api.tzjii.com/api/v1');
    expect(env.s3PublicDomain).toBe('https://oss.tzjii.com/tzj-uploads');
    expect(env.chatSocketUrl).toBe('https://api.tzjii.com');
  });
});
