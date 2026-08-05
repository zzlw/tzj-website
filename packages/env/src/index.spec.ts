import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('环境标志（isProduction / isDev）', () => {
  it('非生产（test）默认 isProduction=false / isDev=true', async () => {
    vi.resetModules();
    const mod = await import('./index');
    expect(mod.isProduction).toBe(false);
    expect(mod.isDev).toBe(true);
  });

  it('production 时 isProduction=true / isDev=false', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    const mod = await import('./index');
    expect(mod.isProduction).toBe(true);
    expect(mod.isDev).toBe(false);
  });
});

describe('getStaticsUrl（规则收口）', () => {
  it('开发/测试环境走应用自身 public/ 根路径', async () => {
    vi.resetModules();
    const { getStaticsUrl } = await import('./index');
    expect(getStaticsUrl('http://localhost:9000/tzj-uploads-dev', 'vditor-assets/x.js')).toBe(
      '/vditor-assets/x.js',
    );
  });

  it('生产环境走 OSS statics/ 前缀，容忍域名尾斜杠与 path 前导斜杠', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    const { getStaticsUrl } = await import('./index');
    expect(getStaticsUrl('https://oss.tzjii.com/tzj-uploads-prod/', '/vditor-assets/x.js')).toBe(
      'https://oss.tzjii.com/tzj-uploads-prod/statics/vditor-assets/x.js',
    );
  });
});
