import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  SiteMediaSettings,
  WatermarkLayout,
  WatermarkOverride,
  WatermarkPosition,
} from '@tzj/types';
import sharp from 'sharp';
import { SettingsService } from '../settings/settings.service';
import { S3Service } from '../storage/s3.service';

const execFileAsync = promisify(execFile);

const SKIP_IMAGE_MIME = new Set(['image/svg+xml', 'image/gif']);

/**
 * video MIME → 容器扩展名（ffmpeg 输出格式由扩展名决定，不能直接拆分 MIME 子类型：
 * `video/quicktime` 拆出 `quicktime` 无法被 ffmpeg 识别为输出格式，须映射为 `mov`）。
 */
const VIDEO_EXT_MAP: Record<string, string> = {
  'video/quicktime': 'mov',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/x-msvideo': 'avi',
  'video/x-matroska': 'mkv',
};

/** 由 video MIME 推导安全的容器扩展名，未知类型回退 mp4 */
export function videoExtFromMime(mimeType: string): string {
  return (
    VIDEO_EXT_MAP[mimeType] ??
    (mimeType.split('/')[1]?.split(';')[0]?.split('+')[0] || 'mp4')
  );
}

/** 中文优先字体栈（librsvg / macOS / Windows 常见字体） */
const FONT_STACK =
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", sans-serif';

type WatermarkConfig = SiteMediaSettings['watermark'];

/** 宽容解析单次上传的水印覆盖参数：非法/缺省值一律回退 auto，不报 400 */
export function normalizeWatermarkOverride(value: unknown): WatermarkOverride {
  return value === 'skip' || value === 'force' ? value : 'auto';
}

export interface ProcessedMedia {
  buffer: Buffer;
  mimeType: string;
  width?: number;
  height?: number;
  /** 本次是否真的烧录了水印（按实际处理结果，非请求意图） */
  watermarked: boolean;
}

@Injectable()
export class WatermarkService {
  private readonly logger = new Logger(WatermarkService.name);
  private ffmpegAvailable: boolean | null = null;

  constructor(
    private readonly settings: SettingsService,
    private readonly s3: S3Service,
    private readonly config: ConfigService,
  ) {}

  async processUpload(
    buffer: Buffer,
    mimeType: string,
    folder: string,
    override: WatermarkOverride = 'auto',
  ): Promise<ProcessedMedia> {
    if (override === 'skip') {
      return { buffer, mimeType, watermarked: false };
    }

    const config = (await this.settings.getSiteMediaSettings()).watermark;
    if (!this.shouldProcess(config, mimeType, folder, override)) {
      return { buffer, mimeType, watermarked: false };
    }

    try {
      if (mimeType.startsWith('image/')) {
        return await this.processImage(buffer, mimeType, config);
      }
      if (mimeType.startsWith('video/')) {
        return await this.processVideo(buffer, mimeType, config);
      }
    } catch (err) {
      this.logger.warn(`水印处理失败，已回退为原文件 (${mimeType}): ${(err as Error).message}`);
    }

    return { buffer, mimeType, watermarked: false };
  }

  private shouldProcess(
    config: WatermarkConfig,
    mimeType: string,
    folder: string,
    override: WatermarkOverride,
  ) {
    // force 仅要求全局 enabled（总开关兼水印内容校验门槛），跳过目录/类型适用范围检查；
    // SVG/GIF 与最小尺寸等“技术不可行”检查对 force 仍生效。
    if (!config.enabled) return false;
    if (override !== 'force' && !config.applyToFolders.includes(folder as 'uploads' | 'cms')) {
      return false;
    }
    if (mimeType.startsWith('image/')) {
      return (override === 'force' || config.applyToImages) && !SKIP_IMAGE_MIME.has(mimeType);
    }
    if (mimeType.startsWith('video/')) {
      return override === 'force' || config.applyToVideos;
    }
    return false;
  }

  private async processImage(
    buffer: Buffer,
    mimeType: string,
    config: WatermarkConfig,
  ): Promise<ProcessedMedia> {
    const base = sharp(buffer, { failOn: 'none' });
    const metadata = await base.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (width < config.minWidth || height < config.minHeight) {
      return { buffer, mimeType, width, height, watermarked: false };
    }

    const overlay = await this.buildFullOverlay(config, width, height);
    const output = await sharp(buffer)
      .composite([{ input: overlay, left: 0, top: 0 }])
      .toBuffer({ resolveWithObject: true });

    const outMime = mimeType === 'image/png' || mimeType === 'image/webp' ? mimeType : 'image/jpeg';

    const encoded =
      outMime === 'image/png'
        ? await sharp(output.data).png().toBuffer()
        : outMime === 'image/webp'
          ? await sharp(output.data).webp({ quality: 90 }).toBuffer()
          : await sharp(output.data).jpeg({ quality: 90 }).toBuffer();

    return {
      buffer: encoded,
      mimeType: outMime,
      width: output.info.width,
      height: output.info.height,
      watermarked: true,
    };
  }

  private async buildFullOverlay(
    config: WatermarkConfig,
    width: number,
    height: number,
  ): Promise<Buffer> {
    switch (config.layout) {
      case 'tile':
        return this.buildTiledOverlay(config, width, height);
      case 'center':
        return this.buildCenterOverlay(config, width, height);
      case 'corner':
      default:
        return this.buildCornerOverlay(config, width, height);
    }
  }

  private async buildCornerOverlay(
    config: WatermarkConfig,
    width: number,
    height: number,
  ): Promise<Buffer> {
    const wmWidth = Math.max(32, Math.round(width * config.scale));
    const stamp = await this.buildStamp(config, wmWidth, 'corner');
    const stampMeta = await sharp(stamp).metadata();
    const wmW = stampMeta.width ?? wmWidth;
    const wmH = stampMeta.height ?? 0;
    const margin = Math.max(12, Math.round(Math.min(width, height) * 0.025));
    const { left, top } = computePlacement(width, height, wmW, wmH, config.position, margin);

    return sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: stamp, left, top }])
      .png()
      .toBuffer();
  }

  private async buildCenterOverlay(
    config: WatermarkConfig,
    width: number,
    height: number,
  ): Promise<Buffer> {
    const wmWidth = Math.max(48, Math.round(Math.min(width, height) * config.scale * 1.6));
    const stamp = await this.buildStamp(config, wmWidth, 'center');
    const stampMeta = await sharp(stamp).metadata();
    const wmW = stampMeta.width ?? wmWidth;
    const wmH = stampMeta.height ?? 0;

    return sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: stamp,
          left: Math.max(0, Math.round((width - wmW) / 2)),
          top: Math.max(0, Math.round((height - wmH) / 2)),
        },
      ])
      .png()
      .toBuffer();
  }

  /** 平铺斜纹：网格排列后整体旋转，业内防盗图常用 */
  private async buildTiledOverlay(
    config: WatermarkConfig,
    width: number,
    height: number,
  ): Promise<Buffer> {
    if (config.mode === 'text') {
      return this.buildTiledTextSvgOverlay(config, width, height);
    }
    return this.buildTiledImageOverlay(config, width, height);
  }

  private async buildTiledTextSvgOverlay(
    config: WatermarkConfig,
    width: number,
    height: number,
  ): Promise<Buffer> {
    const text = config.text.trim() || 'Watermark';
    const fontSize = Math.max(14, Math.min(36, Math.round(width * config.scale * 0.12)));
    const charW = text.length <= 6 ? 1.05 : 0.92;
    const cellW = Math.round(text.length * fontSize * charW * config.tileSpacing);
    const cellH = Math.round(fontSize * 2.8 * config.tileSpacing);
    const svg = buildTilePatternSvg(
      text,
      fontSize,
      cellW,
      cellH,
      config.tileAngle,
      config.opacity,
      width,
      height,
    );
    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private async buildTiledImageOverlay(
    config: WatermarkConfig,
    width: number,
    height: number,
  ): Promise<Buffer> {
    const stampW = Math.max(32, Math.round(width * config.scale * 0.35));
    const stamp = await this.buildStamp(config, stampW, 'tile');
    const meta = await sharp(stamp).metadata();
    const lw = meta.width ?? stampW;
    const lh = meta.height ?? stampW;
    const gap = config.tileSpacing;
    const stepX = Math.max(lw + 8, Math.round(lw * gap));
    const stepY = Math.max(lh + 8, Math.round(lh * gap));

    const pad = Math.ceil(Math.max(width, height) * 0.6);
    const ow = width + pad * 2;
    const oh = height + pad * 2;
    const composites: sharp.OverlayOptions[] = [];

    for (let y = 0; y < oh; y += stepY) {
      for (let x = 0; x < ow; x += stepX) {
        composites.push({ input: stamp, left: x, top: y });
      }
    }

    const grid = await sharp({
      create: {
        width: ow,
        height: oh,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(composites)
      .png()
      .toBuffer();

    const rotated = await sharp(grid)
      .rotate(config.tileAngle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    const rMeta = await sharp(rotated).metadata();
    const rw = rMeta.width ?? ow;
    const rh = rMeta.height ?? oh;
    const left = Math.max(0, Math.round((rw - width) / 2));
    const top = Math.max(0, Math.round((rh - height) / 2));

    return sharp(rotated)
      .extract({
        left: Math.min(left, Math.max(0, rw - width)),
        top: Math.min(top, Math.max(0, rh - height)),
        width: Math.min(width, rw),
        height: Math.min(height, rh),
      })
      .png()
      .toBuffer();
  }

  private async buildStamp(
    config: WatermarkConfig,
    targetWidth: number,
    variant: WatermarkLayout,
  ): Promise<Buffer> {
    if (config.mode === 'image' && config.imageKey) {
      const logoBuffer = await this.s3.getObjectBuffer(config.imageKey);
      const resized = await sharp(logoBuffer)
        .resize({ width: targetWidth, withoutEnlargement: true })
        .ensureAlpha()
        .png()
        .toBuffer();
      const opacity = variant === 'tile' ? Math.min(config.opacity, 0.2) : config.opacity;
      return applyOpacity(resized, opacity);
    }

    const text = config.text.trim() || 'Watermark';
    const fontSize = computeFontSize(text, targetWidth, variant);
    const svg = buildTextStampSvg(text, targetWidth, fontSize, config.opacity, variant);
    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private async processVideo(
    buffer: Buffer,
    mimeType: string,
    config: WatermarkConfig,
  ): Promise<ProcessedMedia> {
    if (!(await this.checkFfmpeg())) {
      this.logger.warn('未检测到 ffmpeg，已跳过视频水印');
      return { buffer, mimeType, watermarked: false };
    }

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tzj-wm-'));
    const ext = videoExtFromMime(mimeType);
    const inputPath = path.join(tmpDir, `input.${ext}`);
    const outputPath = path.join(tmpDir, `output.${ext}`);
    const wmPath = path.join(tmpDir, 'watermark.png');

    try {
      await fs.writeFile(inputPath, buffer);

      // 视频尺寸须用 ffprobe 探测（sharp 仅支持图像，读取视频会抛错）
      const { width: vw, height: vh } = await this.probeVideoDimensions(inputPath);

      const overlay = await this.buildFullOverlay(config, vw, vh);
      await fs.writeFile(wmPath, overlay);

      let filter: string;
      if (config.layout === 'tile' || config.layout === 'center') {
        filter = `[1:v]scale=${vw}:${vh}[wm];[0:v][wm]overlay=0:0`;
      } else {
        const overlayPos = ffmpegOverlayExpr(config.position);
        filter = `[1:v]format=rgba[wm];[0:v][wm]overlay=${overlayPos}`;
      }

      await execFileAsync(
        this.config.get<string>('FFMPEG_PATH', 'ffmpeg'),
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-i',
          inputPath,
          '-i',
          wmPath,
          '-filter_complex',
          filter,
          '-codec:a',
          'copy',
          '-y',
          outputPath,
        ],
        { timeout: 300_000, maxBuffer: 20 * 1024 * 1024 },
      );

      const out = await fs.readFile(outputPath);
      return { buffer: out, mimeType, watermarked: true };
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async checkFfmpeg(): Promise<boolean> {
    if (this.ffmpegAvailable !== null) return this.ffmpegAvailable;
    try {
      await execFileAsync(this.config.get<string>('FFMPEG_PATH', 'ffmpeg'), ['-version']);
      this.ffmpegAvailable = true;
    } catch {
      this.ffmpegAvailable = false;
    }
    return this.ffmpegAvailable;
  }

  /**
   * 用 ffprobe 探测视频宽高（sharp 无法读取视频）。
   * 探测失败时回退默认 1280x720，不阻塞烧录（overlay 按默认尺寸生成仍可用）。
   */
  private async probeVideoDimensions(
    inputPath: string,
  ): Promise<{ width: number; height: number }> {
    try {
      const { stdout } = await execFileAsync(
        this.ffprobePath(),
        [
          '-v',
          'error',
          '-select_streams',
          'v:0',
          '-show_entries',
          'stream=width,height',
          '-of',
          'csv=p=0',
          inputPath,
        ],
        { timeout: 30_000 },
      );
      const [w, h] = stdout.trim().split(',').map(Number);
      if (w !== undefined && h !== undefined && w > 0 && h > 0) return { width: w, height: h };
    } catch (err) {
      this.logger.warn(`ffprobe 探测视频尺寸失败，回退默认 1280x720: ${(err as Error).message}`);
    }
    return { width: 1280, height: 720 };
  }

  /** ffprobe 路径：优先 FFPROBE_PATH，其次与 FFMPEG_PATH 同目录（默认走 PATH） */
  private ffprobePath(): string {
    const configured = this.config.get<string>('FFPROBE_PATH');
    if (configured) return configured;
    const ffmpeg = this.config.get<string>('FFMPEG_PATH', 'ffmpeg');
    const dir = path.dirname(ffmpeg);
    return dir === '.' ? 'ffprobe' : path.join(dir, 'ffprobe');
  }
}

function computeFontSize(text: string, targetWidth: number, variant: WatermarkLayout): number {
  const len = Math.max(text.length, 2);
  if (variant === 'center') {
    return Math.max(20, Math.min(96, Math.round((targetWidth / len) * 1.1)));
  }
  if (variant === 'tile') {
    return Math.max(12, Math.min(28, Math.round((targetWidth / len) * 0.95)));
  }
  return Math.max(16, Math.min(56, Math.round((targetWidth / len) * 1.25)));
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildTextStampSvg(
  text: string,
  width: number,
  fontSize: number,
  opacity: number,
  variant: WatermarkLayout,
): string {
  const safe = escapeXml(text);
  const height = Math.round(fontSize * (variant === 'center' ? 1.35 : 1.55));
  const weight = variant === 'center' ? 600 : 500;

  if (variant === 'tile') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <text x="0" y="${fontSize}" font-size="${fontSize}" font-family='${FONT_STACK}' font-weight="${weight}" fill="#6b7280" fill-opacity="${opacity}">${safe}</text>
</svg>`;
  }

  if (variant === 'center') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="${fontSize}" font-family='${FONT_STACK}' font-weight="${weight}" fill="#ffffff" fill-opacity="${opacity * 0.85}" stroke="#000000" stroke-opacity="${opacity * 0.25}" stroke-width="1" paint-order="stroke">${safe}</text>
</svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000000" flood-opacity="${Math.min(0.55, opacity * 0.85)}"/>
    </filter>
  </defs>
  <text filter="url(#shadow)" x="0" y="${fontSize}" font-size="${fontSize}" font-family='${FONT_STACK}' font-weight="${weight}" fill="#ffffff" fill-opacity="${Math.min(0.95, opacity + 0.1)}">${safe}</text>
</svg>`;
}

function buildTilePatternSvg(
  text: string,
  fontSize: number,
  cellW: number,
  cellH: number,
  angle: number,
  opacity: number,
  canvasW: number,
  canvasH: number,
): string {
  const safe = escapeXml(text);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}">
  <defs>
    <pattern id="wm" width="${cellW}" height="${cellH}" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})">
      <text x="0" y="${Math.round(fontSize * 1.05)}" font-size="${fontSize}" font-family='${FONT_STACK}' font-weight="500" fill="#374151" fill-opacity="${opacity}">${safe}</text>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#wm)"/>
</svg>`;
}

async function applyOpacity(input: Buffer, opacity: number): Promise<Buffer> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) {
    data[i] = Math.round((data[i] ?? 255) * opacity);
  }
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

function computePlacement(
  baseWidth: number,
  baseHeight: number,
  wmWidth: number,
  wmHeight: number,
  position: WatermarkPosition,
  margin: number,
): { left: number; top: number } {
  switch (position) {
    case 'top-left':
      return { left: margin, top: margin };
    case 'top-right':
      return { left: Math.max(margin, baseWidth - wmWidth - margin), top: margin };
    case 'bottom-left':
      return { left: margin, top: Math.max(margin, baseHeight - wmHeight - margin) };
    case 'center':
      return {
        left: Math.max(0, Math.round((baseWidth - wmWidth) / 2)),
        top: Math.max(0, Math.round((baseHeight - wmHeight) / 2)),
      };
    case 'bottom-right':
    default:
      return {
        left: Math.max(margin, baseWidth - wmWidth - margin),
        top: Math.max(margin, baseHeight - wmHeight - margin),
      };
  }
}

function ffmpegOverlayExpr(position: WatermarkPosition): string {
  const m = 12;
  switch (position) {
    case 'top-left':
      return `${m}:${m}`;
    case 'top-right':
      return `W-w-${m}:${m}`;
    case 'bottom-left':
      return `${m}:H-h-${m}`;
    case 'center':
      return `(W-w)/2:(H-h)/2`;
    case 'bottom-right':
    default:
      return `W-w-${m}:H-h-${m}`;
  }
}
