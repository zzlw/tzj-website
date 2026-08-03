import type { HttpException } from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { S3Service } from '../storage/s3.service';
import { MediaService } from './media.service';
import type { MediaGuardService } from './media-guard.service';
import type { WatermarkService } from './watermark.service';

/**
 * 逐张水印操作回归（docs/media-watermark-design.md 第二部分 §7.1）：
 * - 加水印：正常链路（备份 → 覆盖 → DB）、已加水印 400、处理不适用 422、
 *   回收站 409、站点资源 409、资产不存在 404、watermarked=null 视同未加水印；
 * - 去水印：正常链路（安全备份 → 恢复最新备份 → head 回写 DB）、无备份 404、
 *   未加水印 400、回收站 409；
 * - 备份列表取 S3 MaxKeys 上限 1000，防超限误选旧备份。
 */

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
    watermarked: false,
    uploadedById: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    ...overrides,
  };
}

function buildService(opts: { isSiteResource?: boolean } = {}) {
  const findUnique = jest.fn();
  const create = jest.fn();
  const update = jest.fn();
  const prisma = { mediaAsset: { findUnique, create, update } } as unknown as PrismaService;

  const getObjectBuffer = jest.fn();
  const copy = jest.fn().mockResolvedValue(undefined);
  const upload = jest.fn().mockResolvedValue({ key: '', url: '', size: 0, contentType: '' });
  const list = jest.fn();
  const head = jest.fn();
  // 按当前环境公开域重建 url（与 S3Service.getUrl 一致）
  const getUrl = jest.fn((key: string) => `http://localhost:9000/tzj-uploads-dev/${key}`);
  const s3 = { getObjectBuffer, copy, upload, list, head, getUrl } as unknown as S3Service;

  const isStaticSiteAsset = jest.fn(() => opts.isSiteResource ?? false);
  const enrichMany = jest.fn(async (rows: unknown[]) => rows);
  const guard = { isStaticSiteAsset, enrichMany } as unknown as MediaGuardService;

  const processUpload = jest.fn();
  const watermark = { processUpload } as unknown as WatermarkService;

  const service = new MediaService(prisma, s3, guard, watermark);
  return {
    service,
    findUnique,
    create,
    update,
    getObjectBuffer,
    copy,
    upload,
    list,
    head,
    processUpload,
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

describe('MediaService.applyWatermark', () => {
  it('正常链路：下载 → 烧录 → 备份原图 → 同 key 覆盖 → 回写 DB', async () => {
    const { service, findUnique, update, getObjectBuffer, copy, upload, processUpload } =
      buildService();
    findUnique.mockResolvedValue(asset());
    getObjectBuffer.mockResolvedValue(Buffer.from('orig'));
    processUpload.mockResolvedValue({
      buffer: Buffer.from('watermarked!'),
      mimeType: 'image/webp',
      watermarked: true,
    });
    update.mockResolvedValue(asset({ watermarked: true, mimeType: 'image/webp', size: 12 }));

    const result = await service.applyWatermark('cuid1');

    expect(processUpload).toHaveBeenCalledWith(expect.any(Buffer), 'image/jpeg', 'cms', 'force');
    // 备份在覆盖之前，且 key 落在按资产 ID 分目录的 _archive 前缀下
    expect(copy.mock.calls[0]?.[0]).toBe('cms/abc.jpg');
    expect(copy.mock.calls[0]?.[1]).toMatch(
      /^_archive\/watermark\/cuid1\/\d+-[0-9a-f]{8}-abc\.jpg$/,
    );
    expect(copy.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
      upload.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );
    expect(upload).toHaveBeenCalledWith(Buffer.from('watermarked!'), 'cms/abc.jpg', 'image/webp');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'cuid1' },
      data: { watermarked: true, size: 12, mimeType: 'image/webp' },
    });
    expect(result.watermarked).toBe(true);
    expect(typeof result.backupKey).toBe('string');
    // 出口统一按当前环境重建 url（存量素材 DB url 可能是其他环境地址）
    expect(result.url).toBe('http://localhost:9000/tzj-uploads-dev/cms/abc.jpg');
  });

  it('watermarked=null（历史未知）视同未加水印，正常处理', async () => {
    const { service, findUnique, update, getObjectBuffer, processUpload } = buildService();
    findUnique.mockResolvedValue(asset({ watermarked: null }));
    getObjectBuffer.mockResolvedValue(Buffer.from('orig'));
    processUpload.mockResolvedValue({
      buffer: Buffer.from('wm'),
      mimeType: 'image/jpeg',
      watermarked: true,
    });
    update.mockResolvedValue(asset({ watermarked: true }));

    await expect(service.applyWatermark('cuid1')).resolves.toMatchObject({ watermarked: true });
  });

  it('已加水印 → 400 WATERMARK_ALREADY_APPLIED', async () => {
    const { service, findUnique } = buildService();
    findUnique.mockResolvedValue(asset({ watermarked: true }));
    await expectError(
      service.applyWatermark('cuid1'),
      BadRequestException,
      'WATERMARK_ALREADY_APPLIED',
    );
  });

  it('处理不适用（SVG/GIF/尺寸不足）→ 422，且不产生备份', async () => {
    const { service, findUnique, getObjectBuffer, copy, processUpload } = buildService();
    findUnique.mockResolvedValue(asset({ mimeType: 'image/svg+xml' }));
    getObjectBuffer.mockResolvedValue(Buffer.from('<svg/>'));
    processUpload.mockResolvedValue({
      buffer: Buffer.from('<svg/>'),
      mimeType: 'image/svg+xml',
      watermarked: false,
    });

    await expectError(
      service.applyWatermark('cuid1'),
      UnprocessableEntityException,
      'WATERMARK_NOT_APPLICABLE',
    );
    expect(copy).not.toHaveBeenCalled();
  });

  it('回收站资产 → 409 MEDIA_IN_TRASH', async () => {
    const { service, findUnique } = buildService();
    findUnique.mockResolvedValue(asset({ deletedAt: new Date() }));
    await expectError(service.applyWatermark('cuid1'), ConflictException, 'MEDIA_IN_TRASH');
  });

  it('站点静态资源同样支持加水印（2026-08-03 解除限制，备份后可去水印）', async () => {
    const { service, findUnique, update, getObjectBuffer, copy, upload, processUpload } =
      buildService({ isSiteResource: true });
    findUnique.mockResolvedValue(asset({ key: 'content/hero.mp4', mimeType: 'video/mp4' }));
    getObjectBuffer.mockResolvedValue(Buffer.from('orig'));
    processUpload.mockResolvedValue({
      buffer: Buffer.from('watermarked!'),
      mimeType: 'video/mp4',
      watermarked: true,
    });
    update.mockResolvedValue(asset({ watermarked: true, size: 12 }));

    const result = await service.applyWatermark('cuid1');

    // 备份 → 覆盖，key 落在按资产 ID 分目录的 _archive 前缀下
    expect(copy.mock.calls[0]?.[0]).toBe('content/hero.mp4');
    expect(copy.mock.calls[0]?.[1]).toMatch(/^_archive\/watermark\/cuid1\//);
    expect(upload).toHaveBeenCalledWith(
      Buffer.from('watermarked!'),
      'content/hero.mp4',
      'video/mp4',
    );
    expect(result).toMatchObject({ watermarked: true });
  });

  it('资产不存在 → 404', async () => {
    const { service, findUnique } = buildService();
    findUnique.mockResolvedValue(null);
    await expect(service.applyWatermark('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('MediaService.removeWatermark', () => {
  it('正常链路：安全备份当前版本 → 恢复最新备份 → head 回写 DB', async () => {
    const { service, findUnique, update, copy, list, head } = buildService();
    findUnique.mockResolvedValue(asset({ watermarked: true }));
    // 故意乱序返回，验证按时间戳字典序取最新
    list.mockResolvedValue([
      '_archive/watermark/cuid1/200-bbbbbbbb-abc.jpg',
      '_archive/watermark/cuid1/100-aaaaaaaa-abc.jpg',
    ]);
    head.mockResolvedValue({ contentLength: 900, contentType: 'image/jpeg' });
    update.mockResolvedValue(asset({ watermarked: false, size: 900 }));

    const result = await service.removeWatermark('cuid1');

    expect(list).toHaveBeenCalledWith('_archive/watermark/cuid1/', 1000);
    // 第 1 次 copy：带水印版本 → watermark-before-remove 安全备份
    expect(copy.mock.calls[0]?.[0]).toBe('cms/abc.jpg');
    expect(copy.mock.calls[0]?.[1]).toMatch(/^_archive\/watermark-before-remove\/cuid1\//);
    // 第 2 次 copy：最新备份 → 覆盖回原 key
    expect(copy.mock.calls[1]).toEqual([
      '_archive/watermark/cuid1/200-bbbbbbbb-abc.jpg',
      'cms/abc.jpg',
    ]);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'cuid1' },
      data: { watermarked: false, mimeType: 'image/jpeg', size: 900 },
    });
    expect(result.restoredFrom).toBe('_archive/watermark/cuid1/200-bbbbbbbb-abc.jpg');
    // 出口统一按当前环境重建 url
    expect(result.url).toBe('http://localhost:9000/tzj-uploads-dev/cms/abc.jpg');
  });

  it('无备份 → 404 WATERMARK_BACKUP_NOT_FOUND，且不发生任何 copy', async () => {
    const { service, findUnique, copy, list } = buildService();
    findUnique.mockResolvedValue(asset({ watermarked: true }));
    list.mockResolvedValue([]);

    await expectError(
      service.removeWatermark('cuid1'),
      NotFoundException,
      'WATERMARK_BACKUP_NOT_FOUND',
    );
    expect(copy).not.toHaveBeenCalled();
  });

  it('未加水印 → 400 WATERMARK_NOT_APPLIED', async () => {
    const { service, findUnique } = buildService();
    findUnique.mockResolvedValue(asset({ watermarked: false }));
    await expectError(
      service.removeWatermark('cuid1'),
      BadRequestException,
      'WATERMARK_NOT_APPLIED',
    );
  });

  it('回收站资产 → 409 MEDIA_IN_TRASH', async () => {
    const { service, findUnique } = buildService();
    findUnique.mockResolvedValue(asset({ watermarked: true, deletedAt: new Date() }));
    await expectError(service.removeWatermark('cuid1'), ConflictException, 'MEDIA_IN_TRASH');
  });
});

describe('MediaService.uploadAndRegister', () => {
  const file = {
    buffer: Buffer.from('original-bytes'),
    originalname: 'photo.jpg',
    mimetype: 'image/jpeg',
    size: 15,
  };

  it('自动烧录成功时：登记后同步备份原图到 _archive/watermark/{id}/（供去水印恢复）', async () => {
    const { service, create, upload, processUpload } = buildService();
    create.mockResolvedValue(asset({ id: 'cuidNew', key: 'uploads/123-photo.jpg' }));
    processUpload.mockResolvedValue({
      buffer: Buffer.from('watermarked!'),
      mimeType: 'image/webp',
      watermarked: true,
    });
    // 主文件上传 mock 返回登记 key（与 buildKey 格式一致）
    upload.mockResolvedValueOnce({
      key: 'uploads/123-photo.jpg',
      url: '',
      size: 1,
      contentType: '',
    });

    const result = await service.uploadAndRegister(file, 'uploads', 'user1', 'auto');

    // 主文件上传的是烧录产物
    expect(upload.mock.calls[0]?.[0]).toEqual(Buffer.from('watermarked!'));
    // 备份上传的是原始 buffer，且 key 落入 _archive/watermark/{id}/ 前缀
    // （key 格式与 applyWatermark 一致：{ts}-{uuid8}-{basename}，basename 含上传时间戳前缀）
    expect(upload.mock.calls[1]).toEqual([
      Buffer.from('original-bytes'),
      expect.stringMatching(/^_archive\/watermark\/cuidNew\/\d{13}-[0-9a-f]{8}-\d{13}-photo\.jpg$/),
      'image/jpeg',
    ]);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ watermarked: true, key: 'uploads/123-photo.jpg' }),
    });
    expect(result).toEqual(asset({ id: 'cuidNew', key: 'uploads/123-photo.jpg' }));
  });

  it('未烧录（skip/跳过）时不产生备份，仅上传主文件', async () => {
    const { service, create, upload, processUpload } = buildService();
    create.mockResolvedValue(asset({ id: 'cuidNew' }));
    processUpload.mockResolvedValue({
      buffer: Buffer.from('raw'),
      mimeType: 'image/jpeg',
      watermarked: false,
    });

    await service.uploadAndRegister(file, 'uploads', 'user1', 'skip');

    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('主文件上传失败时：向上抛错，不登记素材', async () => {
    const { service, create, upload, processUpload } = buildService();
    create.mockResolvedValue(asset({ id: 'cuidNew' }));
    processUpload.mockResolvedValue({
      buffer: Buffer.from('watermarked!'),
      mimeType: 'image/webp',
      watermarked: true,
    });
    upload.mockRejectedValueOnce(new Error('s3 down'));

    await expect(service.uploadAndRegister(file, 'uploads', 'user1', 'auto')).rejects.toThrow(
      's3 down',
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('主文件上传成功但原图备份失败：不抛错、返回记录（仅失去可逆性）', async () => {
    const { service, create, upload, processUpload } = buildService();
    create.mockResolvedValue(asset({ id: 'cuidNew' }));
    processUpload.mockResolvedValue({
      buffer: Buffer.from('watermarked!'),
      mimeType: 'image/webp',
      watermarked: true,
    });
    upload.mockResolvedValueOnce({
      key: 'uploads/123-photo.jpg',
      url: '',
      size: 1,
      contentType: '',
    });
    upload.mockRejectedValueOnce(new Error('backup failed'));

    const result = await service.uploadAndRegister(file, 'uploads', 'user1', 'auto');

    expect(upload).toHaveBeenCalledTimes(2);
    expect(result).toEqual(asset({ id: 'cuidNew' }));
  });
});
