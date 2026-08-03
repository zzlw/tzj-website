import type { HttpException } from '@nestjs/common';
import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { SettingsService } from '../settings/settings.service';
import type { S3Service } from '../storage/s3.service';
import {
  canonicalWatermarkConfig,
  fingerprintWatermarkConfig,
  type WatermarkService,
} from './watermark.service';
import { WatermarkReburnService } from './watermark-reburn.service';

/**
 * 批量重烧水印回归：
 * - candidates：候选条件（指纹 NULL 或 ≠ 当前指纹）+ 当前指纹透出；
 * - reburn：正常链路（取原图备份 → before-remove 保险 → force 重烧 → 同 key 覆盖 → DB 新指纹）、
 *   全局水印未启用 422、无备份/处理不适用跳过、ids 过滤与非候选提示、
 *   单张异常不阻塞整体、并发互斥、统计返回。
 */

/** 测试用水印配置：与 settings 默认一致 */
const WMCONFIG = {
  enabled: true,
  layout: 'tile',
  mode: 'text',
  text: '河南拓之迹',
  imageKey: undefined,
  opacity: 0.4,
  position: 'bottom-right',
  scale: 0.22,
  tileSpacing: 1.5,
  tileAngle: -25,
  minWidth: 480,
  minHeight: 320,
  applyToImages: true,
  applyToVideos: false,
  applyToFolders: ['uploads', 'cms'],
} as const;

function asset(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cuid1',
    key: 'cms/abc.jpg',
    url: 'https://static.example/cms/abc.jpg',
    filename: 'abc.jpg',
    mimeType: 'image/jpeg',
    size: 1000,
    folder: 'cms',
    alt: null,
    deletedAt: null,
    watermarked: true,
    watermarkParams: null,
    watermarkFingerprint: null,
    uploadedById: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    ...overrides,
  };
}

function buildService(candidates: Record<string, unknown>[]) {
  const findMany = jest.fn();
  const update = jest.fn().mockResolvedValue({});
  const prisma = { mediaAsset: { findMany, update } } as unknown as PrismaService;

  const list = jest.fn().mockResolvedValue([]);
  const getObjectBuffer = jest.fn();
  const head = jest.fn();
  const copy = jest.fn().mockResolvedValue(undefined);
  const upload = jest.fn().mockResolvedValue({ key: '', url: '', size: 0, contentType: '' });
  const s3 = { list, getObjectBuffer, head, copy, upload } as unknown as S3Service;

  const getSiteMediaSettings = jest.fn().mockResolvedValue({ watermark: { ...WMCONFIG } });
  const settings = { getSiteMediaSettings } as unknown as SettingsService;

  const processUpload = jest.fn();
  const watermark = { processUpload } as unknown as WatermarkService;

  const service = new WatermarkReburnService(prisma, s3, settings, watermark);
  findMany.mockResolvedValue(candidates);
  return {
    service,
    findMany,
    update,
    list,
    getObjectBuffer,
    head,
    copy,
    upload,
    processUpload,
    getSiteMediaSettings,
  };
}

/** 断言 HttpException 响应体中的业务 error code */
async function expectError(
  promise: Promise<unknown>,
  ctor: new (...args: never[]) => HttpException,
  error: string,
) {
  await expect(promise).rejects.toBeInstanceOf(ctor);
  await promise.catch((e: HttpException) => {
    expect((e.getResponse() as { error: string }).error).toBe(error);
  });
}

describe('WatermarkReburnService.candidates', () => {
  it('候选条件：已烧录且指纹为 NULL 或与当前指纹不一致；透出当前指纹与数量', async () => {
    const { service, findMany } = buildService([
      asset(),
      asset({ id: 'cuid2', watermarkFingerprint: 'old123' }),
    ]);
    const result = await service.candidates();

    expect(findMany).toHaveBeenCalledWith({
      where: {
        watermarked: true,
        OR: [
          { watermarkFingerprint: null },
          { watermarkFingerprint: { not: fingerprintWatermarkConfig({ ...WMCONFIG }) } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });
    expect(result.count).toBe(2);
    expect(result.currentFingerprint).toBe(fingerprintWatermarkConfig({ ...WMCONFIG }));
    expect(result.assets[1]?.watermarkFingerprint).toBe('old123');
  });
});

describe('WatermarkReburnService.reburn', () => {
  it('全局水印未启用时拒绝（WATERMARK_DISABLED）', async () => {
    const { service, getSiteMediaSettings } = buildService([asset()]);
    getSiteMediaSettings.mockResolvedValue({ watermark: { ...WMCONFIG, enabled: false } });

    await expectError(service.reburn(), UnprocessableEntityException, 'WATERMARK_DISABLED');
    expect(service).toBeDefined();
  });

  it('正常链路：取最新原图备份 → 当前版另存保险 → force 重烧 → 同 key 覆盖 → DB 新指纹+快照', async () => {
    const { service, list, getObjectBuffer, head, copy, upload, update, processUpload } =
      buildService([asset()]);
    const processed = {
      buffer: Buffer.from('wm-bytes'),
      mimeType: 'image/jpeg',
      watermarked: true,
      config: { ...WMCONFIG },
    };
    list.mockResolvedValue(['_archive/watermark/cuid1/1752000000000-orig.jpg']);
    getObjectBuffer.mockResolvedValue(Buffer.from('original'));
    head.mockResolvedValue({ contentLength: 8, contentType: 'image/jpeg' });
    processUpload.mockResolvedValue(processed);

    const result = await service.reburn();

    expect(result).toEqual({ total: 1, reburned: 1, failures: [] });
    // 原图备份按字典序取最新一份
    expect(list).toHaveBeenCalledWith('_archive/watermark/cuid1/', 1000);
    // 重烧不另存当前版本（旧参数版可由「去水印」恢复原图，无需重复备份）
    expect(copy).not.toHaveBeenCalled();
    // force 重烧：以原图实际 MIME 处理，忽略目录/类型适用范围
    expect(processUpload).toHaveBeenCalledWith(
      Buffer.from('original'),
      'image/jpeg',
      'cms',
      'force',
    );
    // 同 key 覆盖，URL 不变
    expect(upload).toHaveBeenCalledWith(processed.buffer, 'cms/abc.jpg', 'image/jpeg');
    // DB：新指纹 + 参数快照 + 实际 size/mimeType
    expect(update).toHaveBeenCalledWith({
      where: { id: 'cuid1' },
      data: {
        watermarked: true,
        size: processed.buffer.length,
        mimeType: 'image/jpeg',
        watermarkParams: {
          config: canonicalWatermarkConfig({ ...WMCONFIG }),
          appliedAt: expect.any(String),
        },
        watermarkFingerprint: fingerprintWatermarkConfig({ ...WMCONFIG }),
      },
    });
  });

  it('原图备份缺失：跳过并记录原因，不触碰主文件', async () => {
    const { service, copy, upload, update } = buildService([asset()]);

    const result = await service.reburn();

    expect(result.reburned).toBe(0);
    expect(result.failures[0]).toMatchObject({
      id: 'cuid1',
      reason: expect.stringContaining('原图备份缺失'),
    });
    expect(copy).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('重烧处理不适用（尺寸不足/格式不支持）：跳过，不覆盖主文件', async () => {
    const { service, list, getObjectBuffer, head, copy, upload, update, processUpload } =
      buildService([asset()]);
    list.mockResolvedValue(['_archive/watermark/cuid1/1752000000000-orig.jpg']);
    getObjectBuffer.mockResolvedValue(Buffer.from('small'));
    head.mockResolvedValue({ contentLength: 5, contentType: 'image/gif' });
    processUpload.mockResolvedValue({
      buffer: Buffer.from('x'),
      mimeType: 'image/gif',
      watermarked: false,
    });

    const result = await service.reburn();

    expect(result.reburned).toBe(0);
    expect(result.failures[0]).toMatchObject({
      id: 'cuid1',
      reason: expect.stringContaining('重烧失败'),
    });
    expect(copy).not.toHaveBeenCalled(); // 不另存当前版本
    expect(upload).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('指定 ids：仅重烧候选 ∩ ids；非候选 id 提示非候选', async () => {
    const { service, upload, update, list, getObjectBuffer, head, processUpload } = buildService([
      asset(),
      asset({ id: 'cuid2', watermarkFingerprint: 'old123' }),
    ]);
    list.mockResolvedValue(['_archive/watermark/cuid1/1752000000000-orig.jpg']);
    getObjectBuffer.mockResolvedValue(Buffer.from('original'));
    head.mockResolvedValue({ contentLength: 8, contentType: 'image/jpeg' });
    processUpload.mockResolvedValue({
      buffer: Buffer.from('wm'),
      mimeType: 'image/jpeg',
      watermarked: true,
      config: { ...WMCONFIG },
    });

    const result = await service.reburn(['cuid1', 'cuid3']);

    expect(result.total).toBe(1); // 请求范围内实际候选只有 cuid1
    expect(result.reburned).toBe(1);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(result.failures).toEqual([
      { id: 'cuid3', filename: 'cuid3', reason: '非候选：未烧录水印或参数已是最新' },
    ]);
  });

  it('单张异常不阻塞整体：失败计入 failures，其余继续重烧', async () => {
    const { service, list, getObjectBuffer, head, upload, update, processUpload } = buildService([
      asset(),
      asset({ id: 'cuid2', filename: 'second.jpg', key: 'cms/second.jpg' }),
    ]);
    list.mockResolvedValue(['_archive/watermark/cuid2/1752000000000-orig.jpg']);
    getObjectBuffer
      .mockRejectedValueOnce(new Error('S3 连接超时'))
      .mockResolvedValueOnce(Buffer.from('original2'));
    head.mockResolvedValue({ contentLength: 9, contentType: 'image/jpeg' });
    processUpload.mockResolvedValue({
      buffer: Buffer.from('wm2'),
      mimeType: 'image/jpeg',
      watermarked: true,
      config: { ...WMCONFIG },
    });

    // 第一张异常（下载失败），第二张正常重烧
    const result = await service.reburn();

    expect(result.reburned).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({
      id: 'cuid1',
      reason: expect.stringContaining('处理异常'),
    });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('并发互斥：执行中再次调用抛 Conflict', async () => {
    const { service, list, getObjectBuffer, head, processUpload } = buildService([asset()]);
    list.mockResolvedValue(['_archive/watermark/cuid1/1752000000000-orig.jpg']);
    getObjectBuffer.mockResolvedValue(Buffer.from('original'));
    head.mockResolvedValue({ contentLength: 8, contentType: 'image/jpeg' });
    let resolveProcess!: (v: unknown) => void;
    processUpload.mockReturnValue(
      new Promise((res) => {
        resolveProcess = res;
      }),
    );

    const first = service.reburn();
    await new Promise((r) => setTimeout(r, 0)); // 等 running=true 进入烧录挂起
    await expectError(service.reburn(), ConflictException, 'WATERMARK_REBURN_IN_PROGRESS');

    resolveProcess({
      buffer: Buffer.from('wm'),
      mimeType: 'image/jpeg',
      watermarked: true,
      config: { ...WMCONFIG },
    });
    const result = await first;
    expect(result.reburned).toBe(1);
    // 互斥锁释放后再次执行正常（同一候选仍会重烧）
    await expect(service.reburn()).resolves.toMatchObject({ total: 1 });
  });

  it('无候选时返回空结果（全量重烧幂等）', async () => {
    const { service } = buildService([]);
    const result = await service.reburn();
    expect(result).toEqual({ total: 0, reburned: 0, failures: [] });
  });
});
