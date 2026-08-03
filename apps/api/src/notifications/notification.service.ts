import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Contact } from '@prisma/client/index';
import type { NotificationTemplate } from '@tzj/types';
import { AliyunDmService } from '../integrations/aliyun-dm.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import {
  DEFAULT_AUTO_REPLY_SUBJECT,
  renderContactAutoReplyHtml,
  renderContactAutoReplyText,
  renderContactStaffNotifyHtml,
  renderContactStaffNotifyText,
} from './email/templates/contact.templates';

interface SendEmailJob {
  template: NotificationTemplate;
  recipient: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aliyunDm: AliyunDmService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
  ) {}

  /** 询盘创建后异步触发（不阻塞 HTTP 响应） */
  dispatchContactCreated(contact: Contact): void {
    setImmediate(() => {
      void this.handleContactCreated(contact).catch((error) => {
        this.logger.error(`询盘通知派发失败 contactId=${contact.id}: ${(error as Error).message}`);
      });
    });
  }

  private async handleContactCreated(contact: Contact): Promise<void> {
    if (!(await this.aliyunDm.isAvailable())) {
      this.logger.debug('邮件集成未启用，跳过询盘通知');
      return;
    }

    const notificationSettings = await this.settings.getSiteNotificationSettings();
    if (!notificationSettings.enabled) {
      this.logger.debug('邮件通知已在站点设置中关闭，跳过询盘通知');
      return;
    }

    const adminBase = this.config.get<string>('ADMIN_URL')?.replace(/\/$/, '') ?? '';
    const adminUrl = adminBase ? `${adminBase}/contacts` : '/contacts';

    const jobs: SendEmailJob[] = [];

    for (const email of notificationSettings.contact.notifyEmails) {
      const trimmed = email.trim();
      if (!trimmed) continue;
      jobs.push({
        template: 'contact.staff-notify',
        recipient: trimmed,
        subject: `[新询盘] ${contact.name}${contact.company ? ` · ${contact.company}` : ''}`,
        html: renderContactStaffNotifyHtml(contact, adminUrl),
        text: renderContactStaffNotifyText(contact, adminUrl),
        idempotencyKey: `contact.staff-notify:${contact.id}:${trimmed.toLowerCase()}`,
        payload: { contactId: contact.id },
      });
    }

    if (notificationSettings.contact.autoReplyEnabled && contact.email?.trim()) {
      const visitorEmail = contact.email.trim();
      const sitePublic = await this.settings.getSitePublicSettings();
      const contactInfo = {
        phone: sitePublic.contact.phone,
        email: sitePublic.contact.email,
      };
      jobs.push({
        template: 'contact.auto-reply',
        recipient: visitorEmail,
        subject:
          notificationSettings.contact.autoReplySubject?.trim() || DEFAULT_AUTO_REPLY_SUBJECT,
        html: renderContactAutoReplyHtml(contact, contactInfo),
        text: renderContactAutoReplyText(contact, contactInfo),
        idempotencyKey: `contact.auto-reply:${contact.id}:${visitorEmail.toLowerCase()}`,
        payload: { contactId: contact.id },
      });
    }

    for (const job of jobs) {
      await this.sendEmailJob(job);
    }
  }

  private async sendEmailJob(job: SendEmailJob): Promise<void> {
    const existing = await this.prisma.notificationLog.findUnique({
      where: { idempotencyKey: job.idempotencyKey },
    });
    if (existing?.status === 'sent') return;

    const log = existing
      ? await this.prisma.notificationLog.update({
          where: { id: existing.id },
          data: {
            status: 'pending',
            error: null,
            subject: job.subject,
            payload: (job.payload ?? undefined) as object | undefined,
          },
        })
      : await this.prisma.notificationLog.create({
          data: {
            channel: 'email',
            template: job.template,
            recipient: job.recipient,
            subject: job.subject,
            status: 'pending',
            idempotencyKey: job.idempotencyKey,
            payload: (job.payload ?? undefined) as object | undefined,
          },
        });

    try {
      await this.aliyunDm.sendMail({
        to: job.recipient,
        subject: job.subject,
        html: job.html,
        text: job.text,
      });
      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: 'sent', sentAt: new Date(), error: null },
      });
    } catch (error) {
      const message = (error as Error).message;
      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: 'failed', error: message },
      });
      this.logger.warn(`邮件发送失败 template=${job.template} to=${job.recipient}: ${message}`);
    }
  }

  /** 每 10 分钟重试失败通知（24 小时内，最多重试由 idempotency 保证不重复发成功） */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async retryFailedNotifications(): Promise<void> {
    if (!(await this.aliyunDm.isAvailable())) return;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const failed = await this.prisma.notificationLog.findMany({
      where: { status: 'failed', createdAt: { gte: since } },
      take: 20,
      orderBy: { createdAt: 'asc' },
    });

    for (const row of failed) {
      const payload = row.payload as { contactId?: string } | null;
      if (!payload?.contactId) continue;

      if (row.template === 'contact.staff-notify' || row.template === 'contact.auto-reply') {
        const contact = await this.prisma.contact.findUnique({
          where: { id: payload.contactId },
        });
        if (contact) {
          await this.handleContactCreated(contact);
        }
      }
    }
  }

  async listLogs(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.notificationLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notificationLog.count(),
    ]);

    return {
      data: data.map((row) => ({
        id: row.id,
        channel: row.channel as 'email',
        template: row.template as NotificationTemplate,
        recipient: row.recipient,
        subject: row.subject,
        status: row.status as 'pending' | 'sent' | 'failed',
        error: row.error,
        sentAt: row.sentAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
