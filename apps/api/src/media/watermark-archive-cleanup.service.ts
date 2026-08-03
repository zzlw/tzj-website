import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { S3Service } from '../storage/s3.service';

/** 原图备份前缀：加水印/自动烧录前备份，去水印恢复依赖 */
const ORIGINAL_PREFIX = '_archive/watermark/';
/** 去水印前快照前缀：纯误操作保险，可重新加水印，无需长期保留 */
const SAFETY_PREFIX = '_archive/watermark-before-remove/';

export interface WatermarkArchiveCleanupResult {
  /** 删除的冗余原图备份份数（每素材仅保留最新 1 份） */
  removedOriginals: number;
  /** 删除的过期快照份数 */
  removedSafetyBackups: number;
  /** 保留的原图备份份数（每素材最新 1 份） */
  keptOriginals: number;
}

/**
 * 水印备份归档清理：`_archive/` 下的水印备份只增不删会无限膨胀
 * （多次烧录/恢复累积、去水印后残留），每日凌晨按以下策略回收：
 * - `_archive/watermark/{id}/`：每素材只保留最新 1 份。旧备份要么已被去水印
 *   消费（恢复后内容与当前文件一致），要么已被新备份覆盖，删除不影响可逆性；
 *   保留最新 1 份保证「去水印」始终可恢复。
 * - `_archive/watermark-before-remove/{id}/`：超过保留期即删，
 *   保留期由 WATERMARK_ARCHIVE_RETENTION_DAYS 配置，默认 30 天。
 * 注：对象存储侧可另叠加 bucket lifecycle 规则做双保险（如 `_archive/` 前缀过期）。
 */
@Injectable()
export class WatermarkArchiveCleanupService {
  private readonly logger = new Logger(WatermarkArchiveCleanupService.name);

  constructor(private readonly s3: S3Service) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async runDailyCleanup(
    retentionDays = Number(process.env.WATERMARK_ARCHIVE_RETENTION_DAYS ?? 30),
  ): Promise<WatermarkArchiveCleanupResult> {
    const { removed: removedOriginals, kept: keptOriginals } =
      await this.cleanupRedundantOriginals();
    const removedSafetyBackups = await this.cleanupExpiredSafetyBackups(retentionDays);

    const total = removedOriginals + removedSafetyBackups;
    if (total > 0) {
      this.logger.log(
        `清理水印备份归档 ${total} 份（冗余原图 ${removedOriginals} 份、过期快照 ${removedSafetyBackups} 份；保留原图备份 ${keptOriginals} 份）`,
      );
    }
    return { removedOriginals, removedSafetyBackups, keptOriginals };
  }

  /**
   * `_archive/watermark/{id}/` 每素材只保留最新 1 份备份。
   * key 前缀为 13 位毫秒时间戳，字典序即时间序（与 removeWatermark 取最新逻辑一致）。
   */
  private async cleanupRedundantOriginals(): Promise<{ removed: number; kept: number }> {
    const keys = await this.s3.list(ORIGINAL_PREFIX, 1000);
    const byAsset = new Map<string, string[]>();
    for (const key of keys) {
      const id = key.split('/')[2];
      if (!id) continue;
      const group = byAsset.get(id);
      if (group) {
        group.push(key);
      } else {
        byAsset.set(id, [key]);
      }
    }

    let removed = 0;
    let kept = 0;
    for (const group of byAsset.values()) {
      group.sort();
      // 字典序最大 = 时间戳最新，保留最后 1 份
      for (const key of group.slice(0, -1)) {
        await this.s3.delete(key).catch(() => undefined);
      }
      removed += group.length - 1;
      kept += 1;
    }
    return { removed, kept };
  }

  /**
   * `_archive/watermark-before-remove/{id}/` 超过保留期即删（误操作后可重新加水印）。
   * key 形如 `.../{13位毫秒时间戳}-{uuid8}-{basename}`，从文件名解析烧录时间。
   */
  private async cleanupExpiredSafetyBackups(retentionDays: number): Promise<number> {
    const cutoff = Date.now() - retentionDays * 86_400_000;
    const keys = await this.s3.list(SAFETY_PREFIX, 1000);

    let removed = 0;
    for (const key of keys) {
      const ts = Number(
        key
          .split('/')
          .at(-1)
          ?.match(/^(\d{13})-/)
          ?.at(1),
      );
      if (Number.isNaN(ts)) {
        // 命名异常无法判定年龄：保守跳过，不误删
        this.logger.warn(`水印快照命名异常，跳过清理: ${key}`);
        continue;
      }
      if (ts < cutoff) {
        await this.s3.delete(key).catch(() => undefined);
        removed += 1;
      }
    }
    return removed;
  }
}
