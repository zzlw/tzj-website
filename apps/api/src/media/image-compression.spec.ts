import sharp from 'sharp';
import { compressUploadImage } from './image-compression';

describe('compressUploadImage', () => {
  it('将大图压缩为 WebP，并把最长边限制到 2560', async () => {
    const width = 4000;
    const height = 2000;
    const raw = Buffer.alloc(width * height * 3);
    // 确定性伪随机噪点（LCG 取高字节），保证 PNG 体积足够大、压缩收益可预期
    let state = 0x12345678;
    for (let i = 0; i < raw.length; i++) {
      state = (state * 1664525 + 1013904223) >>> 0;
      raw[i] = state >>> 24;
    }
    const png = await sharp(raw, { raw: { width, height, channels: 3 } })
      .png()
      .toBuffer();

    const result = await compressUploadImage(png, 'image/png');
    expect(result).not.toBeNull();
    expect(result!.mimeType).toBe('image/webp');
    expect(result!.width).toBe(2560);
    expect(result!.height).toBe(1280);
    expect(result!.buffer.length).toBeLessThan(png.length);
  });

  it('小图压缩后反而更大时返回 null，保留原图', async () => {
    const tiny = await sharp({
      create: { width: 64, height: 64, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer();

    const result = await compressUploadImage(tiny, 'image/png');
    expect(result === null || result!.mimeType === 'image/webp').toBe(true);
  });

  it('SVG / GIF / 非图片不处理', async () => {
    expect(await compressUploadImage(Buffer.from('<svg/>'), 'image/svg+xml')).toBeNull();
    expect(await compressUploadImage(Buffer.from('GIF89a'), 'image/gif')).toBeNull();
    expect(await compressUploadImage(Buffer.from('video'), 'video/mp4')).toBeNull();
  });
});
