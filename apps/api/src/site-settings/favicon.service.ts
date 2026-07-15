// ============================================================
// TZJ API — Favicon Service
// ============================================================
// 处理网站 favicon 的上传、格式转换和存储
// - 支持 PNG/JPG/WebP → ICO 格式自动转换（使用 png-to-ico）
// - 支持 ICO 格式直接上传
// - 存储到 S3/MinIO/OSS: statics/favicon.ico
// ============================================================

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import pngToIco from 'png-to-ico';
import sharp from 'sharp';
import { S3Service } from '../storage/s3.service';

export interface FaviconUploadResult {
  key: string;
  url: string;
  previewUrl?: string; // PNG 预览 URL（用于 <img> 标签显示）
  size: number;
}

@Injectable()
export class FaviconService {
  private readonly logger = new Logger(FaviconService.name);
  private readonly FAVICON_KEY = 'statics/favicon.ico';

  constructor(private readonly s3: S3Service) {}

  /**
   * 上传 favicon
   * - ICO 文件直接存储
   * - PNG/JPG/WebP 自动转换为 ICO 格式
   */
  async uploadAndConvert(buffer: Buffer, mimeType: string): Promise<FaviconUploadResult> {
    let icoBuffer: Buffer;
    let pngPreviewBuffer: Buffer | null = null;

    this.logger.log(`Uploading favicon: mimeType=${mimeType}, size=${buffer.length} bytes`);

    if (this.isIcoFormat(mimeType)) {
      // ICO 格式直接存储，无需转换
      this.logger.log('ICO format detected, storing directly');
      icoBuffer = buffer;

      // 为预览生成 PNG 版本
      try {
        pngPreviewBuffer = await sharp(buffer).png({ quality: 95 }).toBuffer();
        this.logger.log(`PNG preview generated: ${pngPreviewBuffer.length} bytes`);
      } catch (err) {
        this.logger.warn(`Failed to generate PNG preview: ${(err as Error).message}`);
      }
    } else if (this.isSupportedImageFormat(mimeType)) {
      // 图片格式 → 转换为 ICO
      this.logger.log(`Converting ${mimeType} to ICO format...`);
      try {
        icoBuffer = await this.convertToIco(buffer);
        this.logger.log(`Conversion successful: ${icoBuffer.length} bytes`);

        // 保留原始图片作为预览
        pngPreviewBuffer = await sharp(buffer)
          .resize(64, 64, { fit: 'cover', position: 'centre' })
          .png({ quality: 95 })
          .toBuffer();
      } catch (error) {
        this.logger.error(
          `ICO conversion failed: ${(error as Error).message}`,
          (error as Error).stack,
        );
        throw new BadRequestException(`图片转换 ICO 失败: ${(error as Error).message}`);
      }
    } else {
      throw new BadRequestException(`不支持的文件格式: ${mimeType}。支持 ICO、PNG、JPEG、WebP`);
    }

    this.logger.log(`Uploading to S3: key=${this.FAVICON_KEY}, contentType=image/x-icon`);

    try {
      const result = await this.s3.upload(icoBuffer, this.FAVICON_KEY, 'image/x-icon');

      let previewUrl: string | undefined;

      // 如果有 PNG 预览，上传到 S3
      if (pngPreviewBuffer) {
        const previewKey = 'statics/favicon-preview.png';
        const previewResult = await this.s3.upload(pngPreviewBuffer, previewKey, 'image/png');
        previewUrl = previewResult.url;
        this.logger.log(`PNG preview uploaded: ${previewUrl}`);
      }

      this.logger.log(`Favicon uploaded successfully: ${result.url} (${icoBuffer.length} bytes)`);
      return {
        key: result.key,
        url: result.url,
        previewUrl,
        size: icoBuffer.length,
      };
    } catch (error) {
      this.logger.error(`S3 upload failed: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }

  /** 获取当前 favicon URL（不存在返回 null） */
  async getFaviconUrl(): Promise<string | null> {
    const exists = await this.s3.exists(this.FAVICON_KEY);
    if (!exists) return null;
    return this.s3.getUrl(this.FAVICON_KEY);
  }

  /** 获取 favicon 预览 URL（PNG 格式，用于 <img> 标签显示） */
  async getFaviconPreviewUrl(): Promise<string | null> {
    const previewKey = 'statics/favicon-preview.png';
    const exists = await this.s3.exists(previewKey);
    if (!exists) return null;
    return this.s3.getUrl(previewKey);
  }

  /** 删除 favicon */
  async deleteFavicon(): Promise<void> {
    await this.s3.delete(this.FAVICON_KEY);
    // 同时删除预览文件
    await this.s3.delete('statics/favicon-preview.png').catch(() => {});
    this.logger.log('Favicon deleted');
  }

  // ── 私有方法 ─────────────────────────────────────────────

  private isIcoFormat(mimeType: string): boolean {
    const lower = mimeType.toLowerCase();
    return lower === 'image/x-icon' || lower === 'image/vnd.microsoft.icon';
  }

  private isSupportedImageFormat(mimeType: string): boolean {
    return ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(mimeType.toLowerCase());
  }

  /**
   * 将图片转换为 ICO 格式
   * 1. sharp 缩放为 32×32 PNG
   * 2. png-to-ico 封装为标准 ICO 容器
   */
  private async convertToIco(buffer: Buffer): Promise<Buffer> {
    try {
      // 先缩放到 32×32 PNG（ICO 标准尺寸）
      const pngBuffer = await sharp(buffer)
        .resize(32, 32, { fit: 'cover', position: 'centre' })
        .png()
        .toBuffer();

      // png-to-ico 将 PNG 封装为 ICO 格式
      const icoBuf = await pngToIco(pngBuffer);
      return icoBuf;
    } catch (error) {
      this.logger.error(`ICO conversion failed: ${(error as Error).message}`);
      throw new BadRequestException(`图片转换 ICO 失败: ${(error as Error).message}`);
    }
  }
}
