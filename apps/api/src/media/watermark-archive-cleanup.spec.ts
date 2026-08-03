import type { S3Service } from '../storage/s3.service';
import {
  type WatermarkArchiveCleanupResult,
  WatermarkArchiveCleanupService,
} from './watermark-archive-cleanup.service';

describe('WatermarkArchiveCleanupService', () => {
  const DAY = 86_400_000;
  // 固定基准时间（2025-07-06 附近），mock Date.now 使 TTL 判定确定性
  const NOW = 1_752_000_000_000;

  let originals: string[];
  let safetyBackups: string[];
  const deleteMock = jest.fn();
  const s3 = {
    list: jest.fn((prefix: string) =>
      Promise.resolve(prefix.startsWith('_archive/watermark/') ? originals : safetyBackups),
    ),
    delete: deleteMock,
  } as unknown as S3Service;
  let service: WatermarkArchiveCleanupService;

  beforeEach(() => {
    originals = [];
    safetyBackups = [];
    deleteMock.mockReset();
    // S3Service.delete 返回 Promise<void>，基线 resolved 供链路 .catch 正常走通
    deleteMock.mockResolvedValue(undefined);
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    service = new WatermarkArchiveCleanupService(s3);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const expectNoDeletes = (r: WatermarkArchiveCleanupResult) => {
    expect(deleteMock).not.toHaveBeenCalled();
    expect(r).toEqual({ removedOriginals: 0, removedSafetyBackups: 0, keptOriginals: 0 });
  };

  describe('cleanupRedundantOriginals（watermark/ 每素材留最新 1 份）', () => {
    it('同素材多份备份只保留最新 1 份，其余删除', async () => {
      originals = [
        '_archive/watermark/m1/1700000000000-aaaa1111-a.jpg',
        '_archive/watermark/m1/1700000001000-bbbb2222-a.jpg',
        '_archive/watermark/m1/1700000002000-cccc3333-a.jpg',
        '_archive/watermark/m2/1700000000500-dddd4444-b.png',
      ];
      const r = await service.runDailyCleanup(30);

      expect(deleteMock).toHaveBeenCalledTimes(2);
      expect(deleteMock).toHaveBeenCalledWith('_archive/watermark/m1/1700000000000-aaaa1111-a.jpg');
      expect(deleteMock).toHaveBeenCalledWith('_archive/watermark/m1/1700000001000-bbbb2222-a.jpg');
      expect(r).toEqual({ removedOriginals: 2, removedSafetyBackups: 0, keptOriginals: 2 });
    });

    it('同素材仅 1 份备份时不删除', async () => {
      originals = [
        '_archive/watermark/m1/1700000002000-cccc3333-a.jpg',
        '_archive/watermark/m2/1700000000500-dddd4444-b.png',
      ];
      const r = await service.runDailyCleanup(30);
      expect(deleteMock).not.toHaveBeenCalled();
      expect(r).toEqual({ removedOriginals: 0, removedSafetyBackups: 0, keptOriginals: 2 });
    });

    it('无任何备份时不删除', async () => {
      const r = await service.runDailyCleanup(30);
      expectNoDeletes(r);
    });

    it('删除失败不阻塞其他备份清理', async () => {
      originals = [
        '_archive/watermark/m1/1700000000000-aaaa1111-a.jpg',
        '_archive/watermark/m1/1700000001000-bbbb2222-a.jpg',
        '_archive/watermark/m1/1700000002000-cccc3333-a.jpg',
      ];
      deleteMock.mockRejectedValueOnce(new Error('net down'));
      const r = await service.runDailyCleanup(30);
      expect(deleteMock).toHaveBeenCalledTimes(2);
      expect(r.removedOriginals).toBe(2);
      expect(r.keptOriginals).toBe(1);
    });
  });

  describe('cleanupExpiredSafetyBackups（before-remove/ 超过保留期删除）', () => {
    it('超过保留期删、未过期留、同素材互不影响', async () => {
      safetyBackups = [
        `_archive/watermark-before-remove/m1/${NOW - 40 * DAY}-aaaa1111-a.jpg`, // 40 天前 → 删
        `_archive/watermark-before-remove/m1/${NOW - 10 * DAY}-bbbb2222-a.jpg`, // 10 天前 → 留
        `_archive/watermark-before-remove/m2/${NOW - 45 * DAY}-cccc3333-a.jpg`, // 45 天前 → 删
      ];
      const r = await service.runDailyCleanup(30);

      expect(deleteMock).toHaveBeenCalledTimes(2);
      expect(deleteMock).toHaveBeenCalledWith(
        `_archive/watermark-before-remove/m1/${NOW - 40 * DAY}-aaaa1111-a.jpg`,
      );
      expect(deleteMock).toHaveBeenCalledWith(
        `_archive/watermark-before-remove/m2/${NOW - 45 * DAY}-cccc3333-a.jpg`,
      );
      expect(r.removedSafetyBackups).toBe(2);
      expect(r.removedOriginals).toBe(0);
    });

    it('保留期边界：恰好等于 cutoff 的备份不删（lt 而非 lte）', async () => {
      safetyBackups = [`_archive/watermark-before-remove/m1/${NOW - 30 * DAY}-aaaa1111-a.jpg`];
      const r = await service.runDailyCleanup(30);
      expectNoDeletes(r);
    });

    it('命名异常（无 13 位时间戳前缀）保守跳过', async () => {
      safetyBackups = ['_archive/watermark-before-remove/m1/orphan-file.jpg'];
      const r = await service.runDailyCleanup(30);
      expectNoDeletes(r);
    });

    it('retentionDays 为 0 时全部删除', async () => {
      safetyBackups = [`_archive/watermark-before-remove/m1/${NOW - 1}-aaaa1111-a.jpg`];
      const r = await service.runDailyCleanup(0);
      expect(deleteMock).toHaveBeenCalledTimes(1);
      expect(r.removedSafetyBackups).toBe(1);
    });
  });

  describe('runDailyCleanup 汇总', () => {
    it('两类清理合并返回', async () => {
      originals = [
        '_archive/watermark/m1/1700000000000-aaaa1111-a.jpg',
        '_archive/watermark/m1/1700000002000-cccc3333-a.jpg',
      ];
      safetyBackups = [`_archive/watermark-before-remove/m1/${NOW - 40 * DAY}-aaaa1111-a.jpg`];
      const r = await service.runDailyCleanup(30);

      expect(r).toEqual({ removedOriginals: 1, removedSafetyBackups: 1, keptOriginals: 1 });
      expect(deleteMock).toHaveBeenCalledTimes(2);
    });
  });
});
