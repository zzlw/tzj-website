import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';

/**
 * 聊天附件生命周期清理（业内最佳实践）：
 * 1. 回收「预签名上传了但未随消息发出」的孤儿文件（ChatPendingUpload 过期即删 S3 + 库记录）。
 * 2. 回收「已关闭且超过保留期」会话的附件（软删保留期后硬删）。
 *
 * 注：对象存储侧另可叠加 bucket lifecycle 规则做双保险（例如 chat/ 前缀 N 天自动过期）。
 */
@Injectable()
export class ChatAttachmentCleanupService {
  private readonly logger = new Logger(ChatAttachmentCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runDailyCleanup(): Promise<void> {
    await this.cleanupExpiredPendingUploads();
    await this.cleanupRetainedAttachments();
  }

  /** 清理过期的预签名占位（上传了但未发送 → 孤儿回收） */
  async cleanupExpiredPendingUploads(): Promise<number> {
    const expired = await this.prisma.chatPendingUpload.findMany({
      where: { expiresAt: { lt: new Date() } },
      select: { id: true, key: true },
    });
    if (expired.length === 0) return 0;

    for (const p of expired) {
      await this.s3.delete(p.key).catch(() => undefined);
    }
    await this.prisma.chatPendingUpload.deleteMany({
      where: { id: { in: expired.map((e) => e.id) } },
    });

    this.logger.log(`回收 ${expired.length} 个过期待发送上传（孤儿文件）`);
    return expired.length;
  }

  /** 清理已关闭且超保留期的会话附件 */
  async cleanupRetainedAttachments(): Promise<number> {
    const retentionDays = Number(process.env.CHAT_ATTACHMENT_RETENTION_DAYS ?? 365);
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000);

    const rooms = await this.prisma.chatRoom.findMany({
      where: { status: 'closed', closedAt: { lt: cutoff } },
      select: { id: true },
    });
    if (rooms.length === 0) return 0;

    const attachments = await this.prisma.chatAttachment.findMany({
      where: { message: { chatRoomId: { in: rooms.map((r) => r.id) } } },
      select: { id: true, key: true },
    });
    for (const a of attachments) {
      await this.s3.delete(a.key).catch(() => undefined);
    }
    if (attachments.length > 0) {
      await this.prisma.chatAttachment.deleteMany({
        where: { id: { in: attachments.map((a) => a.id) } },
      });
    }

    this.logger.log(`清理 ${attachments.length} 个过期附件（来自 ${rooms.length} 个已关闭会话）`);
    return attachments.length;
  }
}
