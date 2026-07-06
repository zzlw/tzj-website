// ============================================================
// TZJ API — Favicon Service
// ============================================================
// 处理网站 favicon 的上传、格式转换和存储
// - 支持 PNG/JPG/WebP → ICO 格式自动转换（使用 png-to-ico）
// - 支持 ICO 格式直接上传
// - 存储到 S3/MinIO/OSS: statics/favicon.ico
// ============================================================

import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { S3Service } from "../storage/s3.service";

export interface FaviconUploadResult {
  key: string;
  url: string;
  size: number;
}

@Injectable()
export class FaviconService {
  private readonly logger = new Logger(FaviconService.name);
  private readonly FAVICON_KEY = "statics/favicon.ico";

  constructor(private readonly s3: S3Service) {}

  /**
   * 上传 favicon
   * - ICO 文件直接存储
   * - PNG/JPG/WebP 自动转换为 ICO 格式
   */
  async uploadAndConvert(
    buffer: Buffer,
    mimeType: string,
  ): Promise<FaviconUploadResult> {
    let icoBuffer: Buffer;

    if (this.isIcoFormat(mimeType)) {
      // ICO 格式直接存储，无需转换
      icoBuffer = buffer;
    } else if (this.isSupportedImageFormat(mimeType)) {
      // 图片格式 → 转换为 ICO
      icoBuffer = await this.convertToIco(buffer);
    } else {
      throw new BadRequestException(
        `不支持的文件格式: ${mimeType}。支持 ICO、PNG、JPEG、WebP`,
      );
    }

    const result = await this.s3.upload(
      icoBuffer,
      this.FAVICON_KEY,
      "image/x-icon",
    );

    this.logger.log(`Favicon uploaded: ${result.url} (${icoBuffer.length} bytes)`);

    return {
      key: result.key,
      url: result.url,
      size: icoBuffer.length,
    };
  }

  /** 获取当前 favicon URL（不存在返回 null） */
  async getFaviconUrl(): Promise<string | null> {
    const exists = await this.s3.exists(this.FAVICON_KEY);
    if (!exists) return null;
    return this.s3.getUrl(this.FAVICON_KEY);
  }

  /** 删除 favicon */
  async deleteFavicon(): Promise<void> {
    await this.s3.delete(this.FAVICON_KEY);
    this.logger.log("Favicon deleted");
  }

  // ── 私有方法 ─────────────────────────────────────────────

  private isIcoFormat(mimeType: string): boolean {
    const lower = mimeType.toLowerCase();
    return lower === "image/x-icon" || lower === "image/vnd.microsoft.icon";
  }

  private isSupportedImageFormat(mimeType: string): boolean {
    return ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(
      mimeType.toLowerCase(),
    );
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
        .resize(32, 32, { fit: "cover", position: "centre" })
        .png()
        .toBuffer();

      // png-to-ico 将 PNG 封装为 ICO 格式
      const icoBuf = await pngToIco(pngBuffer);
      return icoBuf;
    } catch (error) {
      this.logger.error(`ICO conversion failed: ${(error as Error).message}`);
      throw new BadRequestException(
        `图片转换 ICO 失败: ${(error as Error).message}`,
      );
    }
  }
}
