import sharp from 'sharp';

/** 上传图片最长边限制（超过则等比缩小，防止 C 端直接下发超大原图）。 */
const MAX_IMAGE_EDGE = 2560;
/** WebP 重编码质量（视觉损耗很小，体积通常可降 70%+）。 */
const WEBP_QUALITY = 80;

const COMPRESSIBLE_IMAGE_RE = /^image\/(?:jpeg|png|webp)$/i;

export interface CompressedImage {
  buffer: Buffer;
  mimeType: 'image/webp';
  width: number;
  height: number;
}

/**
 * 上传图片压缩：最长边限制 2560、转 WebP（q80）、按 EXIF 自动旋转并去除元数据。
 *
 * 返回 null 表示不需要压缩（非光栅图 / 解析失败 / 压缩后反而更大），
 * 调用方应保留原文件。SVG/GIF/视频不受影响。
 */
export async function compressUploadImage(
  buffer: Buffer,
  mimeType: string,
): Promise<CompressedImage | null> {
  if (!COMPRESSIBLE_IMAGE_RE.test(mimeType)) return null;

  try {
    const meta = await sharp(buffer, { failOn: 'none' }).metadata();
    if (!meta.width || !meta.height) return null;

    const { data, info } = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize({
        width: MAX_IMAGE_EDGE,
        height: MAX_IMAGE_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    if (data.length >= buffer.length) return null;

    return {
      buffer: data,
      mimeType: 'image/webp',
      width: info.width,
      height: info.height,
    };
  } catch {
    return null;
  }
}
