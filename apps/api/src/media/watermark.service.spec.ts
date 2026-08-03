import type { ConfigService } from '@nestjs/config';
import type { SiteMediaSettings } from '@tzj/types';
import sharp from 'sharp';
import type { SettingsService } from '../settings/settings.service';
import type { S3Service } from '../storage/s3.service';
import {
  normalizeWatermarkOverride,
  videoExtFromMime,
  WatermarkService,
} from './watermark.service';

/**
 * 水印按次覆盖回归（docs/media-watermark-design.md 第一部分 §6）：
 * - skip 绕过全局设置直接返回原文件（watermarked=false），且不读取设置；
 * - force 仅要求 enabled，跳过 applyToFolders/applyToImages/applyToVideos；
 * - force 下 SVG/GIF、最小尺寸等"技术不可行"检查仍生效；
 * - auto 与既有行为逐项一致；
 * - 视频 + ffmpeg 不可用时回退原文件（watermarked=false）；
 * - normalizeWatermarkOverride 对非法值宽容回退 auto。
 */

jest.setTimeout(20_000);

type WatermarkConfig = SiteMediaSettings['watermark'];

function buildConfig(overrides: Partial<WatermarkConfig> = {}): WatermarkConfig {
  return {
    enabled: true,
    layout: 'corner',
    mode: 'text',
    text: 'TZJ',
    opacity: 0.5,
    position: 'bottom-right',
    scale: 0.2,
    tileSpacing: 1.4,
    tileAngle: -30,
    minWidth: 200,
    minHeight: 200,
    applyToImages: true,
    applyToVideos: true,
    applyToFolders: ['uploads', 'cms'],
    ...overrides,
  };
}

function buildService(config: WatermarkConfig) {
  const getSiteMediaSettings = jest.fn(async () => ({ watermark: config }));
  const settings = { getSiteMediaSettings } as unknown as SettingsService;
  const s3 = { getObjectBuffer: jest.fn() } as unknown as S3Service;
  const configService = {
    get: jest.fn((_key: string, defaultValue?: string) => defaultValue),
  } as unknown as ConfigService;
  const service = new WatermarkService(settings, s3, configService);
  return { service, getSiteMediaSettings };
}

describe('normalizeWatermarkOverride', () => {
  it('合法值原样通过', () => {
    expect(normalizeWatermarkOverride('skip')).toBe('skip');
    expect(normalizeWatermarkOverride('force')).toBe('force');
    expect(normalizeWatermarkOverride('auto')).toBe('auto');
  });

  it('非法/缺省值宽容回退 auto，不抛错', () => {
    expect(normalizeWatermarkOverride('yes')).toBe('auto');
    expect(normalizeWatermarkOverride('')).toBe('auto');
    expect(normalizeWatermarkOverride(undefined)).toBe('auto');
    expect(normalizeWatermarkOverride(1)).toBe('auto');
  });
});

describe('videoExtFromMime', () => {
  it('video/quicktime → mov（ffmpeg 无法识别 .quicktime 输出格式，须映射）', () => {
    expect(videoExtFromMime('video/quicktime')).toBe('mov');
  });

  it('已知容器映射原样通过', () => {
    expect(videoExtFromMime('video/mp4')).toBe('mp4');
    expect(videoExtFromMime('video/webm')).toBe('webm');
    expect(videoExtFromMime('video/x-msvideo')).toBe('avi');
  });

  it('未知/含参数 MIME 宽容回退（拆子类型，空则 mp4）', () => {
    expect(videoExtFromMime('video/ogg')).toBe('ogg');
    expect(videoExtFromMime('video/mp4; codecs=avc1')).toBe('mp4');
    expect(videoExtFromMime('')).toBe('mp4');
  });
});

describe('WatermarkService.processUpload', () => {
  let bigJpeg: Buffer; // 800x600，超过 minWidth/minHeight
  let smallJpeg: Buffer; // 100x80，低于最小尺寸
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"/>');
  const fakeVideo = Buffer.from('not-a-real-mp4');

  beforeAll(async () => {
    bigJpeg = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 180, g: 30, b: 30 } },
    })
      .jpeg()
      .toBuffer();
    smallJpeg = await sharp({
      create: { width: 100, height: 80, channels: 3, background: { r: 30, g: 30, b: 180 } },
    })
      .jpeg()
      .toBuffer();
  });

  it('skip：直接返回原文件且不读取全局设置', async () => {
    const { service, getSiteMediaSettings } = buildService(buildConfig());
    const result = await service.processUpload(bigJpeg, 'image/jpeg', 'uploads', 'skip');
    expect(result.watermarked).toBe(false);
    expect(result.buffer).toBe(bigJpeg);
    expect(getSiteMediaSettings).not.toHaveBeenCalled();
  });

  it('auto：命中全局设置时烧录（watermarked=true，产物与原图不同）', async () => {
    const { service } = buildService(buildConfig());
    const result = await service.processUpload(bigJpeg, 'image/jpeg', 'uploads', 'auto');
    expect(result.watermarked).toBe(true);
    expect(result.buffer.equals(bigJpeg)).toBe(false);
  });

  it('auto：目录不在 applyToFolders 时不处理（与既有行为一致）', async () => {
    const { service } = buildService(buildConfig());
    const result = await service.processUpload(bigJpeg, 'image/jpeg', 'products', 'auto');
    expect(result.watermarked).toBe(false);
    expect(result.buffer).toBe(bigJpeg);
  });

  it('缺省 override 参数时行为与 auto 完全一致（改造前回归）', async () => {
    const { service } = buildService(buildConfig());
    const result = await service.processUpload(bigJpeg, 'image/jpeg', 'uploads');
    expect(result.watermarked).toBe(true);
  });

  it('force：跳过 applyToFolders 检查，目录外也烧录', async () => {
    const { service } = buildService(buildConfig());
    const result = await service.processUpload(bigJpeg, 'image/jpeg', 'products', 'force');
    expect(result.watermarked).toBe(true);
    expect(result.buffer.equals(bigJpeg)).toBe(false);
  });

  it('force：跳过 applyToImages 开关', async () => {
    const { service } = buildService(buildConfig({ applyToImages: false }));
    const result = await service.processUpload(bigJpeg, 'image/jpeg', 'uploads', 'force');
    expect(result.watermarked).toBe(true);
  });

  it('force：不绕过 enabled 总开关', async () => {
    const { service } = buildService(buildConfig({ enabled: false }));
    const result = await service.processUpload(bigJpeg, 'image/jpeg', 'uploads', 'force');
    expect(result.watermarked).toBe(false);
    expect(result.buffer).toBe(bigJpeg);
  });

  it('force：SVG 仍跳过（技术不可行检查不受 force 影响）', async () => {
    const { service } = buildService(buildConfig());
    const result = await service.processUpload(svg, 'image/svg+xml', 'uploads', 'force');
    expect(result.watermarked).toBe(false);
    expect(result.buffer).toBe(svg);
  });

  it('force：低于最小尺寸的小图仍跳过', async () => {
    const { service } = buildService(buildConfig());
    const result = await service.processUpload(smallJpeg, 'image/jpeg', 'uploads', 'force');
    expect(result.watermarked).toBe(false);
    expect(result.buffer).toBe(smallJpeg);
  });

  it('视频 + ffmpeg 不可用：回退原文件（watermarked=false）', async () => {
    const { service } = buildService(buildConfig());
    // 注入 ffmpeg 探测缓存，避免依赖测试机环境
    (service as unknown as { ffmpegAvailable: boolean | null }).ffmpegAvailable = false;
    const result = await service.processUpload(fakeVideo, 'video/mp4', 'uploads', 'force');
    expect(result.watermarked).toBe(false);
    expect(result.buffer).toBe(fakeVideo);
  });
});
