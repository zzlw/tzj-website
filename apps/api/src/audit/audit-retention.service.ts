import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 审计日志保留期清理（P2）：AuditLog 只增不删会无限膨胀，
 * 按保留期定时硬删过期记录（口径对齐 ChatAttachment 的回收策略）。
 * 保留期通过 AUDIT_LOG_RETENTION_DAYS 配置，默认 365 天。
 */
@Injectable()
export class AuditRetentionService {
  private readonly logger = new Logger(AuditRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async runDailyCleanup(): Promise<number> {
    const retentionDays = Number(process.env.AUDIT_LOG_RETENTION_DAYS ?? 365);
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000);

    const { count } = await this.prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (count > 0) {
      this.logger.log(`清理 ${count} 条超过 ${retentionDays} 天保留期的审计日志`);
    }
    return count;
  }
}
