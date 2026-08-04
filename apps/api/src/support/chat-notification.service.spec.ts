import type { ConfigService } from '@nestjs/config';
import type { ExmailSmtpService } from '../integrations/exmail-smtp.service';
import type { SettingsService } from '../settings/settings.service';
import { ChatNotificationService } from './chat-notification.service';

/**
 * ChatNotificationService 回归（docs/dm-to-exmail-migration-plan.md §4.2.4/§4.2.7）：
 * - 注入对象由 AliyunDmService 切换为 ExmailSmtpService 后，离线留言提醒行为不变；
 * - 同一房间 10 分钟去抖只发一次；不同房间各发一次；
 * - 集成未启用 / 站点通知关闭 / 无收件人 → 静默跳过；
 * - 失败仅记日志，不抛出。
 */

function setup() {
  const mail = {
    isAvailable: jest.fn().mockResolvedValue(true),
    sendMail: jest.fn().mockResolvedValue(undefined),
  } as unknown as ExmailSmtpService;

  const settings = {
    getSiteNotificationSettings: jest.fn().mockResolvedValue({
      enabled: true,
      contact: { notifyEmails: ['sales@tzjii.com'] },
    }),
  } as unknown as SettingsService;

  const config = {
    get: jest.fn().mockReturnValue('http://admin.local'),
  } as unknown as ConfigService;

  const svc = new ChatNotificationService(mail, settings, config);
  return { svc, mail, settings };
}

describe('ChatNotificationService', () => {
  it('同一房间 10 分钟内去抖，只发一次', async () => {
    const { svc, mail } = setup();

    await svc.notifyOfflineMessage('room-1', 'v@example.com');
    await svc.notifyOfflineMessage('room-1', 'v@example.com');

    expect(mail.sendMail).toHaveBeenCalledTimes(1);
    expect(mail.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'sales@tzjii.com',
        subject: expect.stringContaining('[离线留言]'),
      }),
    );
  });

  it('不同房间各发一次', async () => {
    const { svc, mail } = setup();

    await svc.notifyOfflineMessage('room-1', 'v1@example.com');
    await svc.notifyOfflineMessage('room-2', 'v2@example.com');

    expect(mail.sendMail).toHaveBeenCalledTimes(2);
  });

  it('集成未启用时静默跳过', async () => {
    const { svc, mail } = setup();
    (mail.isAvailable as jest.Mock).mockResolvedValue(false);

    await svc.notifyOfflineMessage('room-1', 'v@example.com');

    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('站点通知关闭时静默跳过', async () => {
    const { svc, mail, settings } = setup();
    (settings.getSiteNotificationSettings as jest.Mock).mockResolvedValue({
      enabled: false,
      contact: { notifyEmails: ['sales@tzjii.com'] },
    });

    await svc.notifyOfflineMessage('room-1', 'v@example.com');

    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('收件人全部为空时不发信', async () => {
    const { svc, mail, settings } = setup();
    (settings.getSiteNotificationSettings as jest.Mock).mockResolvedValue({
      enabled: true,
      contact: { notifyEmails: ['  ', ''] },
    });

    await svc.notifyOfflineMessage('room-1', 'v@example.com');

    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('发送失败仅记日志，不抛出异常', async () => {
    const { svc, mail } = setup();
    (mail.sendMail as jest.Mock).mockRejectedValue(new Error('526 Authentication failure'));

    await expect(svc.notifyOfflineMessage('room-1', 'v@example.com')).resolves.toBeUndefined();
  });
});
