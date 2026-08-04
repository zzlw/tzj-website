import type { ConfigService } from '@nestjs/config';
import type { Contact } from '@prisma/client/index';
import type { ExmailSmtpService } from '../integrations/exmail-smtp.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { SettingsService } from '../settings/settings.service';
import { NotificationService } from './notification.service';

/**
 * NotificationService 回归（docs/dm-to-exmail-migration-plan.md §4.2.4/§4.2.7）：
 * - 注入对象由 AliyunDmService 切换为 ExmailSmtpService 后，幂等/重试/模板行为不变；
 * - 集成未启用 → 跳过；站点通知关闭 → 跳过；
 * - staff-notify 按收件人逐封发送 + auto-reply 条件发送；
 * - 幂等：已有 sent 日志不重发；失败标记 failed；
 * - retryFailedNotifications 24h 内重试 failed 且 contact 仍存在。
 */

const fakeContact = {
  id: 'c1',
  name: '张三',
  phone: '13800000000',
  email: 'visitor@example.com',
  company: null,
  subject: '咨询',
  message: '你好，想了解训练塔产品。',
  source: 'website',
  createdAt: new Date('2026-08-01T00:00:00Z'),
} as unknown as Contact;

function flushAsync() {
  return new Promise((resolve) => setImmediate(resolve));
}

function setup() {
  const mail = {
    isAvailable: jest.fn().mockResolvedValue(true),
    sendMail: jest.fn().mockResolvedValue(undefined),
  } as unknown as ExmailSmtpService;

  const log = {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation(async (args: { data: { idempotencyKey: string } }) => ({
      id: 'log-1',
      status: 'pending',
      idempotencyKey: args.data.idempotencyKey,
    })),
    update: jest.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      id: 'log-1',
      status: args.data.status ?? 'pending',
    })),
  };
  const prisma = {
    notificationLog: log,
    contact: { findUnique: jest.fn().mockResolvedValue(fakeContact) },
  } as unknown as PrismaService;

  const settings = {
    getSiteNotificationSettings: jest.fn().mockResolvedValue({
      enabled: true,
      contact: {
        notifyEmails: ['sales@tzjii.com', 'ops@tzjii.com'],
        autoReplyEnabled: true,
      },
    }),
    getSitePublicSettings: jest.fn().mockResolvedValue({
      contact: { phone: '0371-58691119', email: 'contact@tzjii.com' },
    }),
  } as unknown as SettingsService;

  const config = {
    get: jest.fn().mockReturnValue('http://admin.local'),
  } as unknown as ConfigService;

  const svc = new NotificationService(prisma, mail, settings, config);
  return { svc, mail, prisma, log, settings };
}

describe('NotificationService', () => {
  it('集成未启用时跳过，不创建日志不发信', async () => {
    const { svc, mail, prisma } = setup();
    (mail.isAvailable as jest.Mock).mockResolvedValue(false);

    svc.dispatchContactCreated(fakeContact);
    await flushAsync();

    expect(mail.sendMail).not.toHaveBeenCalled();
    expect(prisma.notificationLog.create).not.toHaveBeenCalled();
  });

  it('站点通知关闭时跳过', async () => {
    const { svc, mail, settings } = setup();
    (settings.getSiteNotificationSettings as jest.Mock).mockResolvedValue({
      enabled: false,
      contact: { notifyEmails: ['sales@tzjii.com'], autoReplyEnabled: true },
    });

    svc.dispatchContactCreated(fakeContact);
    await flushAsync();

    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('正常流程：2 个 staff 收件人 + 1 封自动回复，全部 sent', async () => {
    const { svc, mail, log, prisma } = setup();

    svc.dispatchContactCreated(fakeContact);
    await flushAsync();

    expect(mail.sendMail).toHaveBeenCalledTimes(3);
    // staff-notify ×2（收件人逐封）
    expect(mail.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'sales@tzjii.com',
        subject: expect.stringContaining('[新询盘]'),
      }),
    );
    expect(mail.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'ops@tzjii.com' }));
    // auto-reply 发给访客
    expect(mail.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'visitor@example.com',
        html: expect.stringContaining('可直接回复本邮件'),
      }),
    );
    // 3 条日志均标记 sent
    expect(log.update).toHaveBeenCalledTimes(3);
    expect(log.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'sent' }) }),
    );
    expect(prisma.notificationLog.create).toHaveBeenCalledTimes(3);
  });

  it('幂等：已有 sent 日志不重发', async () => {
    const { svc, mail, log } = setup();
    log.findUnique.mockResolvedValue({ id: 'log-1', status: 'sent' });

    svc.dispatchContactCreated(fakeContact);
    await flushAsync();

    expect(mail.sendMail).not.toHaveBeenCalled();
    expect(log.update).not.toHaveBeenCalled();
  });

  it('发送失败标记 failed 并保留错误信息', async () => {
    const { svc, mail, log } = setup();
    (mail.sendMail as jest.Mock).mockRejectedValue(new Error('526 Authentication failure'));

    svc.dispatchContactCreated(fakeContact);
    await flushAsync();

    expect(log.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'failed', error: '526 Authentication failure' } }),
    );
  });

  it('retryFailedNotifications：24h 内 failed 且 contact 存在时重发', async () => {
    const { svc, mail, log, prisma } = setup();
    log.findMany = jest.fn().mockResolvedValue([
      {
        id: 'log-f',
        status: 'failed',
        template: 'contact.staff-notify',
        recipient: 'sales@tzjii.com',
        payload: { contactId: 'c1' },
        createdAt: new Date(),
      },
    ]);

    await svc.retryFailedNotifications();

    expect(prisma.contact.findUnique).toHaveBeenCalledWith({ where: { id: 'c1' } });
    // 重发：staff-notify ×2 + auto-reply ×1
    expect(mail.sendMail).toHaveBeenCalledTimes(3);
  });
});
