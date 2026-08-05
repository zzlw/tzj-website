import { describe, expect, it } from 'vitest';
import { ossImageLoader } from '@/lib/oss-image-loader';

const PROD_SRC = 'https://static.example.com/tzj-uploads-prod/content/case-henan-hero.png';

describe('ossImageLoader', () => {
  it('生产环境按宽度自动分级质量并转 WebP', () => {
    const process = (width: number, quality?: number) =>
      decodeURIComponent(ossImageLoader({ src: PROD_SRC, width, quality }));

    expect(process(640)).toContain('quality,q_70');
    expect(process(1200)).toContain('quality,q_75');
    expect(process(1920)).toContain('quality,q_82');
    expect(process(1920, 90)).toContain('quality,q_90');
    expect(process(640)).toContain('format,webp');
  });

  it('本地 MinIO 只附加宽度参数，不触发 OSS 处理', () => {
    const url = ossImageLoader({
      src: 'http://localhost:9000/tzj-uploads-dev/content/a.jpg',
      width: 640,
      quality: undefined,
    });
    expect(url).toBe('http://localhost:9000/tzj-uploads-dev/content/a.jpg?w=640');
  });

  it('SVG/GIF 不缩放，原样返回', () => {
    expect(
      ossImageLoader({ src: 'https://static.example.com/tzj-uploads-prod/a.svg', width: 640 }),
    ).toBe('https://static.example.com/tzj-uploads-prod/a.svg');
    expect(
      ossImageLoader({ src: 'https://static.example.com/tzj-uploads-prod/a.gif', width: 640 }),
    ).toBe('https://static.example.com/tzj-uploads-prod/a.gif');
  });
});
