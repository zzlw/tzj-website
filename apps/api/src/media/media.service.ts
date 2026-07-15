import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { RegisterMediaDto } from './dto/media.dto';
import {
  MediaGuardService,
  PROTECTED_MEDIA_FOLDERS,
  SITE_ARCHIVE_PREFIX,
} from './media-guard.service';
import { WatermarkService } from './watermark.service';

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
  normalizeUploadFolder(folder: string | undefined): string {
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

    const data = trash ? rows : await this.guard.enrichMany(rows);

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
  ) {
    const dir = this.normalizeUploadFolder(folder);
    const key = this.buildKey(dir, file.originalname);
    const processed = await this.watermark.processUpload(file.buffer, file.mimetype, dir);
    const result = await this.s3.upload(processed.buffer, key, processed.mimeType);
    return this.prisma.mediaAsset.create({
      data: {
        key: result.key,
        url: result.url,
        filename: file.originalname,
        mimeType: processed.mimeType,
        size: processed.buffer.length,
        width: processed.width,
        height: processed.height,
        folder: dir,
        uploadedById: userId,
      },
    });
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
    return enriched[0] ?? restored;
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
      },
    });

    const enriched = await this.guard.enrichMany([updated]);
    const row = enriched[0] ?? updated;
    return {
      ...row,
      backupKey,
      replaced: true,
    };
  }
}
