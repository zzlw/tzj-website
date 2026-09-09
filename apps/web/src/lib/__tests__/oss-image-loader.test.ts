import { describe, expect, it } from 'vitest';
import { ossAvifSrcSet, ossImageLoader } from '@/lib/oss-image-loader';

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
      src: 'http://localhost:3290/tzj-uploads-dev/content/a.jpg',
      width: 640,
      quality: undefined,
    });
    expect(url).toBe('http://localhost:3290/tzj-uploads-dev/content/a.jpg?w=640');
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

describe('ossAvifSrcSet', () => {
  it('按 next/image 候选宽度生成 AVIF 候选集，质量分级与 WebP 一致', () => {
    const srcSet = decodeURIComponent(ossAvifSrcSet(PROD_SRC) ?? '');
    const candidates = srcSet.split(', ');

    expect(candidates).toHaveLength(16);
    expect(candidates[0]).toContain('resize,w_16');
    expect(candidates[0]).toMatch(/ 16w$/);
    expect(candidates.at(-1)).toMatch(/ 3840w$/);
    expect(srcSet).toContain('format,avif');
    expect(srcSet).not.toContain('format,webp');
    // 与 ossImageLoader 相同的按宽度分级
    expect(candidates.find((c) => c.endsWith(' 640w'))).toContain('quality,q_70');
    expect(candidates.find((c) => c.endsWith(' 1920w'))).toContain('quality,q_82');
  });

  it('显式 quality 覆盖分级', () => {
    const srcSet = decodeURIComponent(ossAvifSrcSet(PROD_SRC, 90) ?? '');
    expect(srcSet).toContain('quality,q_90');
    expect(srcSet).not.toContain('quality,q_70');
  });

  it('本地 MinIO 与 SVG/GIF 没有 AVIF 候选', () => {
    expect(ossAvifSrcSet('http://localhost:3290/tzj-uploads-dev/content/a.jpg')).toBeNull();
    expect(ossAvifSrcSet('https://static.example.com/tzj-uploads-prod/a.svg')).toBeNull();
    expect(ossAvifSrcSet('https://static.example.com/tzj-uploads-prod/a.gif')).toBeNull();
    expect(ossAvifSrcSet('')).toBeNull();
  });
});
