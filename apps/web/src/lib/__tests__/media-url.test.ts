import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultSocialQrPath,
  extractMediaObjectKey,
  getStaticsUrl,
  normalizeStorageUrl,
  resolveMediaUrl,
} from '@/lib/media-url';

/** vitest 下 NODE_ENV=test，env.ts 走开发默认值（本地 MinIO 域名） */
const DOMAIN = 'http://localhost:9000/tzj-uploads-dev';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getStaticsUrl（规则收口）', () => {
  it('开发/测试环境走应用自身 public/ 根路径', () => {
    expect(getStaticsUrl(DOMAIN, 'vditor-assets/dist/js/lute/lute.min.js')).toBe(
      '/vditor-assets/dist/js/lute/lute.min.js',
    );
    expect(getStaticsUrl(DOMAIN, 'browser-support.js')).toBe('/browser-support.js');
  });

  it('生产环境走 OSS statics/ 前缀', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.tzjii.com/api/v1');
    vi.stubEnv('NEXT_PUBLIC_S3_PUBLIC_DOMAIN', 'https://oss.tzjii.com/tzj-uploads-prod');
    const { getStaticsUrl: prodGetStaticsUrl } = await import('@/lib/media-url');
    expect(
      prodGetStaticsUrl(
        'https://oss.tzjii.com/tzj-uploads-prod',
        'vditor-assets/dist/js/lute/lute.min.js',
      ),
    ).toBe('https://oss.tzjii.com/tzj-uploads-prod/statics/vditor-assets/dist/js/lute/lute.min.js');
    expect(prodGetStaticsUrl('https://oss.tzjii.com/tzj-uploads-prod', 'browser-support.js')).toBe(
      'https://oss.tzjii.com/tzj-uploads-prod/statics/browser-support.js',
    );
  });
});

describe('extractMediaObjectKey', () => {
  it('空值 / 纯文件名返回 undefined', () => {
    expect(extractMediaObjectKey(undefined)).toBeUndefined();
    expect(extractMediaObjectKey(null)).toBeUndefined();
    expect(extractMediaObjectKey('  ')).toBeUndefined();
    expect(extractMediaObjectKey('logo.png')).toBeUndefined();
    expect(extractMediaObjectKey('/wechat.jpg')).toBeUndefined();
  });

  it('相对 key（含路径分隔符、无协议）原样返回', () => {
    expect(extractMediaObjectKey('uploads/202601/a.jpg')).toBe('uploads/202601/a.jpg');
    expect(extractMediaObjectKey('content/tower-chino.jpg')).toBe('content/tower-chino.jpg');
  });

  it('MinIO / OSS 原生域名剥离 bucket 名', () => {
    expect(extractMediaObjectKey(`${DOMAIN}/uploads/a.jpg`)).toBe('uploads/a.jpg');
    expect(
      extractMediaObjectKey('https://oss-cn-beijing.aliyuncs.com/tzj-uploads/images/202601/b.webp'),
    ).toBe('images/202601/b.webp');
  });

  it('公开域含 bucket 时正确剥离，并折叠误重复的 bucket', () => {
    expect(extractMediaObjectKey('tzj-uploads-prod/content/tower-eastside.jpg')).toBe(
      'content/tower-eastside.jpg',
    );
    expect(
      extractMediaObjectKey(
        'tzj-uploads-prod/tzj-uploads-prod/tzj-uploads-prod/content/tower-eastside.jpg',
      ),
    ).toBe('content/tower-eastside.jpg');
    expect(extractMediaObjectKey(`${DOMAIN}/tzj-uploads-dev/content/a.jpg`)).toBe('content/a.jpg');
  });

  it('无法定位 key 的绝对 URL 返回 undefined', () => {
    expect(extractMediaObjectKey('http://example.com/')).toBeUndefined();
    expect(extractMediaObjectKey('http://example.com/bucket-only')).toBeUndefined();
  });
});

describe('normalizeStorageUrl', () => {
  it('OSS path-style URL 归一到当前公开域', () => {
    expect(
      normalizeStorageUrl('https://oss-cn-beijing.aliyuncs.com/tzj-uploads/images/x.jpg'),
    ).toBe(`${DOMAIN}/images/x.jpg`);
  });

  it('提取不到 key 时原样返回', () => {
    expect(normalizeStorageUrl('http://example.com/')).toBe('http://example.com/');
  });
});

describe('resolveMediaUrl', () => {
  it('空值返回空串', () => {
    expect(resolveMediaUrl(undefined)).toBe('');
    expect(resolveMediaUrl('')).toBe('');
  });

  it('/media/ 前缀映射到 content/ 对象', () => {
    expect(resolveMediaUrl('/media/hero.mp4')).toBe(`${DOMAIN}/content/hero.mp4`);
  });

  it('相对对象 key 拼接公开域', () => {
    expect(resolveMediaUrl('uploads/202601/a.jpg')).toBe(`${DOMAIN}/uploads/202601/a.jpg`);
  });

  it('public 根路径单文件映射到 content/', () => {
    expect(resolveMediaUrl('/wechat.jpg')).toBe(`${DOMAIN}/content/wechat.jpg`);
  });

  it('多级绝对路径（非 /media/）原样返回', () => {
    expect(resolveMediaUrl('/a/b.jpg')).toBe('/a/b.jpg');
  });

  it('绝对 URL 走 normalizeStorageUrl 归一', () => {
    expect(
      resolveMediaUrl('https://oss-cn-beijing.aliyuncs.com/tzj-uploads/content/tower.jpg'),
    ).toBe(`${DOMAIN}/content/tower.jpg`);
  });

  it('误拼多重 bucket 的绝对 URL 归一到单次公开域前缀', () => {
    expect(resolveMediaUrl(`${DOMAIN}/tzj-uploads-dev/tzj-uploads-dev/content/a.jpg`)).toBe(
      `${DOMAIN}/content/a.jpg`,
    );
  });
});

describe('defaultSocialQrPath', () => {
  it('微信 / 抖音有默认 key，其余为空', () => {
    expect(defaultSocialQrPath('wechat')).toBe('content/wechat.jpg');
    expect(defaultSocialQrPath('douyin')).toBe('content/douyin.jpg');
    expect(defaultSocialQrPath('weibo')).toBe('');
    expect(defaultSocialQrPath('xiaohongshu')).toBe('');
  });
});
