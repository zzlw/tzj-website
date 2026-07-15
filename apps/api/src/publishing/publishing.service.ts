import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ContentStatus } from '../common/enums/content-status.enum';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 定时发布调度器：每分钟扫描到点的草稿（scheduledAt <= now 且仍为 draft），
 * 自动置为 published。新闻同时写入 publishedAt。
 */
@Injectable()
export class PublishingService {
  private readonly logger = new Logger(PublishingService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async publishDue(): Promise<void> {
    const now = new Date();
    const due = {
      status: ContentStatus.DRAFT,
      scheduledAt: { not: null, lte: now },
    } as const;

    const [cases, news, blogs, tradeShows] = await this.prisma.$transaction([
      this.prisma.case.updateMany({
        where: due,
        data: { status: ContentStatus.PUBLISHED, systemPublishedAt: now },
      }),
      this.prisma.news.updateMany({
        where: due,
        data: {
          status: ContentStatus.PUBLISHED,
          publishedAt: now,
          systemPublishedAt: now,
        },
      }),
      this.prisma.blog.updateMany({
        where: due,
        data: {
          status: ContentStatus.PUBLISHED,
          publishedAt: now,
          systemPublishedAt: now,
        },
      }),
      this.prisma.tradeShow.updateMany({
        where: due,
        data: {
          status: ContentStatus.PUBLISHED,
          publishedAt: now,
          systemPublishedAt: now,
        },
      }),
    ]);

    const total = cases.count + news.count + blogs.count + tradeShows.count;
    if (total > 0) {
      this.logger.log(
        `定时发布：案例 ${cases.count}、新闻 ${news.count}、博客 ${blogs.count}、展会 ${tradeShows.count}`,
      );
    }
  }
}
