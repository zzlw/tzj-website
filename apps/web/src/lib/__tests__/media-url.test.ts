import { describe, expect, it } from 'vitest';
import {
  defaultSocialQrPath,
  extractMediaObjectKey,
  normalizeStorageUrl,
  resolveMediaUrl,
} from '@/lib/media-url';

/** vitest 下 NODE_ENV=test，env.ts 走开发默认值（本地 MinIO 域名） */
const DOMAIN = 'http://localhost:9000/tzj-uploads-dev';

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

  it('自定义 CDN 域名（.jiawen.live / 含 static）path 即完整 key', () => {
    expect(extractMediaObjectKey('https://tzj-static.jiawen.live/content/tower.jpg')).toBe(
      'content/tower.jpg',
    );
    expect(extractMediaObjectKey('https://cdn-static.example.com/uploads/c.png')).toBe(
      'uploads/c.png',
    );
  });

  it('无法定位 key 的绝对 URL 返回 undefined', () => {
    expect(extractMediaObjectKey('http://example.com/')).toBeUndefined();
    expect(extractMediaObjectKey('http://example.com/bucket-only')).toBeUndefined();
  });
});

describe('normalizeStorageUrl', () => {
  it('历史环境 URL 归一到当前 MinIO 域名', () => {
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

  it('相对对象 key 拼接 MinIO 域名', () => {
    expect(resolveMediaUrl('uploads/202601/a.jpg')).toBe(`${DOMAIN}/uploads/202601/a.jpg`);
  });

  it('public 根路径单文件映射到 content/', () => {
    expect(resolveMediaUrl('/wechat.jpg')).toBe(`${DOMAIN}/content/wechat.jpg`);
  });

  it('多级绝对路径（非 /media/）原样返回', () => {
    expect(resolveMediaUrl('/a/b.jpg')).toBe('/a/b.jpg');
  });

  it('绝对 URL 走 normalizeStorageUrl 归一', () => {
    expect(resolveMediaUrl('https://tzj-static.jiawen.live/content/tower.jpg')).toBe(
      `${DOMAIN}/content/tower.jpg`,
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
