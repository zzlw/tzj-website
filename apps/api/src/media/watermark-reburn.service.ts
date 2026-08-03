import {
  ConflictException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { S3Service } from '../storage/s3.service';
import {
  buildWatermarkSnapshot,
  fingerprintWatermarkConfig,
  WatermarkService,
} from './watermark.service';

export interface WatermarkReburnFailure {
  id: string;
  filename: string;
  reason: string;
}

export interface WatermarkReburnResult {
  /** 本次请求范围内的候选素材数（总候选 ∩ 指定 ids） */
  total: number;
  /** 成功按当前配置重烧的素材数 */
  reburned: number;
  /** 未处理素材明细：原图备份缺失 / 处理不适用 / 非候选 / 执行异常 */
  failures: WatermarkReburnFailure[];
}

export interface WatermarkReburnCandidates {
  /** 候选素材数（旧参数水印，含指纹为 NULL 的历史素材） */
  count: number;
  /** 当前配置指纹（重烧后的目标指纹） */
  currentFingerprint: string;
  assets: {
    id: string;
    filename: string;
    folder: string;
    key: string;
    size: number;
    mimeType: string;
    updatedAt: Date;
    watermarkFingerprint: string | null;
    watermarkParams: unknown;
  }[];
}

/**
 * 批量重烧水印：找出用旧参数烧录的素材（watermarkFingerprint 为空或与当前配置指纹
 * 不一致），按当前站点设置重新烧录，补齐 2026-08-03 参数快照功能上线前无法追溯的历史素材。
 *
 * 单张流程：取 `_archive/watermark/{id}/` 最新原图备份 → force 重烧 → 同 key 覆盖（URL 不变）
 * → 回写 DB 新指纹 + 参数快照。
 * 原图备份本身不更新（重烧产物是带水印图，不是原图）；重烧前不另存当前版本
 * （旧参数版可在重烧后通过「去水印」恢复原图，无需重复占用存储）。
 *
 * 安全设计：内存互斥防并发双跑；逐张串行处理，单张失败不阻塞整体；
 * 主文件先于 DB 落新参数，DB 写失败仅记录（文件已可用，指纹下次重跑会补齐）。
 */
@Injectable()
export class WatermarkReburnService {
  private readonly logger = new Logger(WatermarkReburnService.name);
  /** 内存互斥：批量重烧为重量级操作，串行执行 */
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly settings: SettingsService,
    private readonly watermark: WatermarkService,
  ) {}

  /** 当前配置指纹（重烧后的目标指纹）。 */
  private async currentFingerprint(): Promise<string> {
    const settings = await this.settings.getSiteMediaSettings();
    return fingerprintWatermarkConfig(settings.watermark);
  }

  /** 候选条件：已烧录水印且指纹为空（快照上线前）或与当前配置不一致。 */
  private staleWhere(fingerprint: string): Prisma.MediaAssetWhereInput {
    return {
      watermarked: true,
      OR: [{ watermarkFingerprint: null }, { watermarkFingerprint: { not: fingerprint } }],
    };
  }

  /** 列出需重烧的素材（供管理端预览确认；enabled 关闭时仍可查看，仅重烧被拦截）。 */
  async candidates(): Promise<WatermarkReburnCandidates> {
    const fingerprint = await this.currentFingerprint();
    const assets = await this.prisma.mediaAsset.findMany({
      where: this.staleWhere(fingerprint),
      orderBy: { updatedAt: 'desc' },
    });
    return {
      count: assets.length,
      currentFingerprint: fingerprint,
      assets: assets.map((a) => ({
        id: a.id,
        filename: a.filename,
        folder: a.folder,
        key: a.key,
        size: a.size,
        mimeType: a.mimeType,
        updatedAt: a.updatedAt,
        watermarkFingerprint: a.watermarkFingerprint,
        watermarkParams: a.watermarkParams,
      })),
    };
  }

  /**
   * 批量重烧。ids 缺省 = 全部候选；指定 ids 时仅重烧候选 ∩ ids，
   * 请求了但不在候选内的素材（未烧录 / 参数已最新）计入 failures，不报错。
   */
  async reburn(ids?: string[]): Promise<WatermarkReburnResult> {
    if (this.running) {
      throw new ConflictException({
        error: 'WATERMARK_REBURN_IN_PROGRESS',
        message: '批量重烧正在执行中，请稍后再试',
      });
    }

    const settings = await this.settings.getSiteMediaSettings();
    if (!settings.watermark.enabled) {
      throw new UnprocessableEntityException({
        error: 'WATERMARK_DISABLED',
        message: '全局水印未启用，无法批量重烧。请先在站点设置中开启水印。',
      });
    }
    const fingerprint = fingerprintWatermarkConfig(settings.watermark);

    const candidates = await this.prisma.mediaAsset.findMany({
      where: this.staleWhere(fingerprint),
      select: { id: true, filename: true, folder: true, key: true, mimeType: true },
    });

    const failures: WatermarkReburnFailure[] = [];
    const requested = ids?.length ? new Set(ids) : null;
    const targets = candidates.filter((a) => !requested || requested.has(a.id));

    if (requested) {
      const candidateIds = new Set(candidates.map((c) => c.id));
      for (const id of requested) {
        if (!candidateIds.has(id)) {
          failures.push({ id, filename: id, reason: '非候选：未烧录水印或参数已是最新' });
        }
      }
    }

    this.running = true;
    try {
      let reburned = 0;
      for (const asset of targets) {
        const reason = await this.reburnOne(asset);
        if (reason === null) {
          reburned += 1;
        } else {
          failures.push({ id: asset.id, filename: asset.filename, reason });
        }
      }
      if (targets.length > 0) {
        this.logger.log(
          `批量重烧水印完成：重烧 ${reburned} 张，未处理 ${failures.length} 张（共 ${targets.length} 张）`,
        );
      }
      return { total: targets.length, reburned, failures };
    } finally {
      this.running = false;
    }
  }

  /** 单张重烧：返回 null 表示成功，否则为未处理原因。 */
  private async reburnOne(asset: {
    id: string;
    filename: string;
    folder: string;
    key: string;
    mimeType: string;
  }): Promise<string | null> {
    try {
      // 1. 原图备份：与去水印一致，取 _archive/watermark/{id}/ 字典序最新一份
      const backups = await this.s3.list(`_archive/watermark/${asset.id}/`, 1000);
      const originalKey = backups.sort()[backups.length - 1];
      if (!originalKey) {
        return '原图备份缺失，无法重烧（该素材也无法去水印，需重新上传原图）';
      }

      // 2. 以原图实际 MIME 重烧（水印处理可能改过主文件类型，备份才是原始类型）
      const original = await this.s3.getObjectBuffer(originalKey);
      const originalHead = await this.s3.head(originalKey);

      // 3. force 重烧：忽略目录/类型适用范围，仍受全局总开关与 SVG/GIF/最小尺寸硬性约束
      const processed = await this.watermark.processUpload(
        original,
        originalHead.contentType,
        asset.folder,
        'force',
      );
      if (!processed.watermarked || !processed.config) {
        return '重烧失败：尺寸不足、格式不支持（SVG/GIF）或处理异常';
      }

      // 4. 同 key 覆盖（URL 不变），主文件先于 DB 落新参数
      await this.s3.upload(processed.buffer, asset.key, processed.mimeType);

      // 5. 回写 DB：新指纹 + 参数快照（原图备份保持不变，仍是原图）
      await this.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: {
          watermarked: true,
          size: processed.buffer.length,
          mimeType: processed.mimeType,
          watermarkParams: buildWatermarkSnapshot(processed.config),
          watermarkFingerprint: fingerprintWatermarkConfig(processed.config),
        },
      });
      return null;
    } catch (err) {
      this.logger.warn(`素材 ${asset.id}（${asset.filename}）重烧异常: ${(err as Error).message}`);
      return `处理异常：${(err as Error).message}`;
    }
  }
}
