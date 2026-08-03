import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client/index';
import type { WatermarkOverride } from '@tzj/types';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { RegisterMediaDto } from './dto/media.dto';
import {
  MediaGuardService,
  PROTECTED_MEDIA_FOLDERS,
  SITE_ARCHIVE_PREFIX,
} from './media-guard.service';
import {
  buildWatermarkSnapshot,
  fingerprintWatermarkConfig,
  WatermarkService,
} from './watermark.service';

interface FindAllParams {
  page: number;
  limit: number;
  type?: string; // image | video | file
  folder?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  trash?: boolean;
}

const MEDIA_SORT_FIELDS = ['createdAt', 'filename', 'size', 'updatedAt'] as const;

const TYPE_PREFIX: Record<string, string> = {
  image: 'image/',
  video: 'video/',
};

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly guard: MediaGuardService,
    private readonly watermark: WatermarkService,
  ) {}

  /** 规范化对象 key：`folder/时间戳-安全文件名`。 */
  buildKey(folder: string | undefined, filename: string): string {
    const dir = this.normalizeUploadFolder(folder);
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${dir}/${Date.now()}-${safe}`;
  }

  /** 禁止普通上传写入站点静态目录。 */
  private normalizeUploadFolder(folder: string | undefined): string {
    const dir = (folder || 'uploads').replace(/^\/+|\/+$/g, '');
    this.assertUploadFolderAllowed(dir);
    return dir;
  }

  private assertUploadFolderAllowed(folder: string, key?: string) {
    if (
      PROTECTED_MEDIA_FOLDERS.has(folder) ||
      folder.startsWith('content/') ||
      key?.startsWith('content/')
    ) {
      throw new BadRequestException({
        error: 'MEDIA_FOLDER_RESERVED',
        message:
          'content/ 为站点静态资源专用目录，请使用 uploads 或 cms；替换站点资源请使用「替换」功能',
      });
    }
  }

  async findAll(params: FindAllParams) {
    const { page, limit, type, folder, search, sortBy, sortOrder, trash } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.MediaAssetWhereInput = trash
      ? { deletedAt: { not: null } }
      : { deletedAt: null };

    if (type && TYPE_PREFIX[type]) {
      where.mimeType = { startsWith: TYPE_PREFIX[type] };
    } else if (type === 'file') {
      where.NOT = [{ mimeType: { startsWith: 'image/' } }, { mimeType: { startsWith: 'video/' } }];
    }
    if (folder) where.folder = folder;
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { filename: { contains: q, mode: 'insensitive' } },
        { alt: { contains: q, mode: 'insensitive' } },
        { folder: { contains: q, mode: 'insensitive' } },
        { key: { contains: q, mode: 'insensitive' } },
      ];
    }

    const sortField = MEDIA_SORT_FIELDS.includes(sortBy as (typeof MEDIA_SORT_FIELDS)[number])
      ? sortBy!
      : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    const [rows, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortField]: order },
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);

    const data = (trash ? rows : await this.guard.enrichMany(rows)).map((row) =>
      this.toEnvUrl(row),
    );

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** 服务端直接上传文件并登记素材。 */
  async uploadAndRegister(
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    folder: string | undefined,
    userId: string | undefined,
    watermark: WatermarkOverride = 'auto',
  ) {
    const dir = this.normalizeUploadFolder(folder);
    const key = this.buildKey(dir, file.originalname);
    const processed = await this.watermark.processUpload(
      file.buffer,
      file.mimetype,
      dir,
      watermark,
    );
    const result = await this.s3.upload(processed.buffer, key, processed.mimeType);
    const data: Prisma.MediaAssetUncheckedCreateInput = {
      key: result.key,
      url: result.url,
      filename: file.originalname,
      mimeType: processed.mimeType,
      size: processed.buffer.length,
      width: processed.width,
      height: processed.height,
      folder: dir,
      uploadedById: userId,
      // 按实际处理结果记录：true=已烧录；false=服务端经手但未烧录（skip/跳过/回退）
      watermarked: processed.watermarked,
    };
    // 烧录成功时落参数快照 + 配置指纹（供识别旧参数素材）；历史数据/未烧录为 null
    if (processed.watermarked && processed.config) {
      data.watermarkParams = buildWatermarkSnapshot(processed.config);
      data.watermarkFingerprint = fingerprintWatermarkConfig(processed.config);
    }
    const record = await this.prisma.mediaAsset.create({ data });

    // 自动烧录（auto/force 且实际烧录成功）时同步备份原图，与手动 applyWatermark
    // 共用 `_archive/watermark/{id}/` 前缀，保证后续「去水印」可从此恢复；
    // 备份失败仅告警不阻塞上传（主文件已落库，图片本身可用，仅失去可逆性）。
    if (processed.watermarked) {
      const basename = key.split('/').pop() ?? record.id;
      const backupKey = `_archive/watermark/${record.id}/${Date.now()}-${randomUUID().slice(0, 8)}-${basename}`;
      try {
        await this.s3.upload(file.buffer, backupKey, file.mimetype);
      } catch (err) {
        this.logger.warn(`自动烧录后原图备份失败（该素材将无法去水印）: ${(err as Error).message}`);
      }
    }

    return record;
  }

  /** 直传完成后登记素材记录。 */
  async register(dto: RegisterMediaDto, userId: string | undefined) {
    const folder = this.normalizeUploadFolder(dto.folder);
    this.assertUploadFolderAllowed(folder, dto.key);
    return this.prisma.mediaAsset.create({
      data: {
        key: dto.key,
        url: this.s3.getUrl(dto.key),
        filename: dto.filename,
        mimeType: dto.mimeType,
        size: dto.size,
        folder,
        alt: dto.alt,
        uploadedById: userId,
      },
    });
  }

  private async getActiveOrThrow(id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException(`素材 ID "${id}" 未找到`);
    return asset;
  }

  /**
   * 按当前环境公开域重写 url。
   * 本地库由生产快照恢复而来，存量素材的 url 可能是其他环境地址
   * （如 static.tzjii.com 生产 OSS），导致预览/复制链接落到错误环境；
   * key 是唯一稳定标识，出口统一以 S3_PUBLIC_DOMAIN + key 重建 url。
   */
  private toEnvUrl<T extends { key: string; url: string }>(row: T): T {
    return { ...row, url: this.s3.getUrl(row.key) };
  }

  private assertDeletable(report: Awaited<ReturnType<MediaGuardService['inspect']>>) {
    if (report.isSiteResource) {
      throw new ConflictException({
        error: 'MEDIA_PROTECTED',
        message: '该素材为站点静态资源，无法删除',
        details: {
          isSiteResource: true,
          isProtected: true,
          references: [],
        },
      });
    }
    if (report.usageCount > 0) {
      throw new ConflictException({
        error: 'MEDIA_IN_USE',
        message: `该素材正在被 ${report.usageCount} 处内容引用，无法删除`,
        details: {
          isSiteResource: false,
          isProtected: true,
          references: report.references,
          usageCount: report.usageCount,
        },
      });
    }
  }

  /** 软删除：移入回收站，不删除 MinIO 对象。 */
  async softRemove(id: string) {
    const asset = await this.getActiveOrThrow(id);
    if (asset.deletedAt) {
      throw new ConflictException({
        error: 'MEDIA_ALREADY_TRASHED',
        message: '该素材已在回收站中',
      });
    }

    const report = await this.guard.inspect(asset);
    this.assertDeletable(report);

    await this.prisma.mediaAsset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { deleted: true, soft: true };
  }

  /** 从回收站恢复。 */
  async restore(id: string) {
    const asset = await this.getActiveOrThrow(id);
    if (!asset.deletedAt) {
      throw new ConflictException({
        error: 'MEDIA_NOT_TRASHED',
        message: '该素材不在回收站中',
      });
    }
    const restored = await this.prisma.mediaAsset.update({
      where: { id },
      data: { deletedAt: null },
    });
    const enriched = await this.guard.enrichMany([restored]);
    return this.toEnvUrl(enriched[0] ?? restored);
  }

  /** 物理清除：删除 MinIO 对象与数据库记录（需 media.purge）。 */
  async purge(id: string) {
    const asset = await this.getActiveOrThrow(id);
    if (!asset.deletedAt) {
      throw new ConflictException({
        error: 'MEDIA_NOT_TRASHED',
        message: '请先将素材移入回收站，再执行永久删除',
      });
    }

    try {
      await this.s3.delete(asset.key);
    } catch {
      // 忽略对象已不存在的情况
    }
    await this.prisma.mediaAsset.delete({ where: { id } });
    return { deleted: true, purged: true };
  }

  /**
   * 替换站点静态资源：备份旧文件 → 同 key 覆盖 → 更新元数据。
   * URL 不变，官网引用无需修改；浏览器/CDN 可能需刷新缓存。
   */
  async replaceSiteAsset(
    id: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    userId: string | undefined,
  ) {
    const asset = await this.getActiveOrThrow(id);
    if (asset.deletedAt) {
      throw new ConflictException({
        error: 'MEDIA_IN_TRASH',
        message: '回收站中的素材请先恢复后再替换',
      });
    }
    if (!this.guard.isStaticSiteAsset(asset)) {
      throw new ConflictException({
        error: 'MEDIA_NOT_SITE_ASSET',
        message: '仅可替换站点静态清单内的固定 key 资源',
      });
    }

    const backupKey = `${SITE_ARCHIVE_PREFIX}${Date.now()}-${asset.key.split('/').pop()}`;
    if (await this.s3.exists(asset.key)) {
      await this.s3.copy(asset.key, backupKey);
    }

    const result = await this.s3.upload(file.buffer, asset.key, file.mimetype);
    const updated = await this.prisma.mediaAsset.update({
      where: { id },
      data: {
        mimeType: file.mimetype,
        size: file.size ?? result.size,
        uploadedById: userId ?? asset.uploadedById,
        // 替换链路不经水印处理，新文件状态未知，回置为 null
        watermarked: null,
      },
    });

    const enriched = await this.guard.enrichMany([updated]);
    const row = this.toEnvUrl(enriched[0] ?? updated);
    return {
      ...row,
      backupKey,
      replaced: true,
    };
  }

  /**
   * 对单张资产烧录水印（存量补水印）。
   * 先备份原图到 `_archive/watermark/{id}/` 再同 key 覆盖，URL 不变；
   * 格式适用性由 WatermarkService.shouldProcess 判定（force 跳过目录/类型范围，
   * 但 SVG/GIF/最小尺寸仍硬性拦截），处理失败时返回 422。
   */
  async applyWatermark(id: string) {
    const asset = await this.getActiveOrThrow(id);
    if (asset.deletedAt) {
      throw new ConflictException({
        error: 'MEDIA_IN_TRASH',
        message: '回收站中的素材请先恢复后再加水印',
      });
    }
    if (asset.watermarked === true) {
      throw new BadRequestException({
        error: 'WATERMARK_ALREADY_APPLIED',
        message: '该素材已烧录水印，如需更换请先去水印再重新添加',
      });
    }

    const buffer = await this.s3.getObjectBuffer(asset.key);
    const processed = await this.watermark.processUpload(
      buffer,
      asset.mimeType,
      asset.folder,
      'force',
    );
    if (!processed.watermarked) {
      throw new UnprocessableEntityException({
        error: 'WATERMARK_NOT_APPLICABLE',
        message: '该素材无法加水印：尺寸不足、格式不支持（SVG/GIF）或处理异常',
      });
    }

    // 备份 → 覆盖（随机后缀防并发碰撞）
    const basename = asset.key.split('/').pop() ?? asset.id;
    const backupKey = `_archive/watermark/${asset.id}/${Date.now()}-${randomUUID().slice(0, 8)}-${basename}`;
    await this.s3.copy(asset.key, backupKey);
    await this.s3.upload(processed.buffer, asset.key, processed.mimeType);

    const updateData: Prisma.MediaAssetUncheckedUpdateInput = {
      watermarked: true,
      size: processed.buffer.length,
      mimeType: processed.mimeType,
    };
    // 落参数快照 + 配置指纹：水印外观变化（改设置）后可据此识别旧参数素材
    if (processed.config) {
      updateData.watermarkParams = buildWatermarkSnapshot(processed.config);
      updateData.watermarkFingerprint = fingerprintWatermarkConfig(processed.config);
    }
    const updated = await this.prisma.mediaAsset.update({ where: { id }, data: updateData });
    const enriched = await this.guard.enrichMany([updated]);
    return { ...this.toEnvUrl(enriched[0] ?? updated), backupKey };
  }

  /**
   * 去水印：从 `_archive/watermark/{id}/` 取最新备份恢复原图。
   * 恢复前先把当前带水印版本另存到 `_archive/watermark-before-remove/`（防误操作）；
   * 水印处理可能改变过 mimeType/size，恢复后须以备份文件实际元信息回写 DB。
   */
  async removeWatermark(id: string) {
    const asset = await this.getActiveOrThrow(id);
    if (asset.deletedAt) {
      throw new ConflictException({
        error: 'MEDIA_IN_TRASH',
        message: '回收站中的素材请先恢复后再去水印',
      });
    }
    if (asset.watermarked !== true) {
      throw new BadRequestException({
        error: 'WATERMARK_NOT_APPLIED',
        message: '该素材未烧录水印，无需去除',
      });
    }

    const prefix = `_archive/watermark/${asset.id}/`;
    // 取 S3 MaxKeys 上限 1000：若用更小值，备份超限时返回的是「最旧 N 条」，
    // sort 取尾会误选旧备份。手工逐张场景远达不到 1000，此处仅作正确性兜底。
    const backups = await this.s3.list(prefix, 1000);
    if (backups.length === 0) {
      throw new NotFoundException({
        error: 'WATERMARK_BACKUP_NOT_FOUND',
        message: '未找到该素材的备份文件，无法去水印。请从存储控制台手动恢复原图。',
      });
    }
    // key 前缀为 13 位毫秒时间戳，字典序即时间序，取最新
    const latest = backups.sort().at(-1)!;

    const basename = asset.key.split('/').pop() ?? asset.id;
    const safetyBackup = `_archive/watermark-before-remove/${asset.id}/${Date.now()}-${randomUUID().slice(0, 8)}-${basename}`;
    await this.s3.copy(asset.key, safetyBackup);
    await this.s3.copy(latest, asset.key);

    const head = await this.s3.head(asset.key);
    const updateData: Prisma.MediaAssetUncheckedUpdateInput = {
      watermarked: false,
      mimeType: head.contentType,
      size: head.contentLength,
      // 已恢复原图，参数快照/指纹随烧录状态一并清空，避免残留误导
      // （Json 字段须用 DbNull 表达 DB 层 NULL；字面量 null 在 Prisma 语义为“不清除”）
      watermarkParams: Prisma.DbNull,
      watermarkFingerprint: null,
    };
    const updated = await this.prisma.mediaAsset.update({ where: { id }, data: updateData });
    const enriched = await this.guard.enrichMany([updated]);
    return { ...this.toEnvUrl(enriched[0] ?? updated), restoredFrom: latest };
  }
}
