import { Injectable, Logger } from '@nestjs/common';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { ConfigService } from '@nestjs/config';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { AliyunDmService } from '../integrations/aliyun-dm.service';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { SettingsService } from '../settings/settings.service';

/**
 * 聊天离线留言 → 坐席通知（P2 M3）。
 *
 * 当访客在「无坐席在线」的会话里留言时，主动邮件通知配置中的客服邮箱，
 * 形成「离线留言 → 坐席及时感知」的闭环。复用站点通知设置里的 staff notify 邮箱，
 * 与询盘通知共用收件人配置，避免重复维护。
 *
 * 设计要点：
 *  - 去抖：同一房间 10 分钟内只发一次离线提醒，避免访客刷屏式留言触发邮件风暴。
 *  - 邮件不可用时（未配置阿里云 DM / 站点关闭通知）静默跳过，不影响主流程。
 *  - 失败仅记日志，不阻断消息落库。
 */
@Injectable()
export class ChatNotificationService {
  private readonly logger = new Logger(ChatNotificationService.name);
  /** roomId -> 上次通知时间（内存去抖，单实例即可；多实例下最坏情况是多实例各发一次，影响极小） */
  private readonly lastNotifiedAt = new Map<string, number>();
  private readonly DEBOUNCE_MS = 10 * 60 * 1000;

  constructor(
    private readonly aliyunDm: AliyunDmService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
  ) {}

  /** 访客向无人在线的会话留言 → 通知坐席。幂等去抖由调用方负责判「是否无人在线」。 */
  async notifyOfflineMessage(roomId: string, clientEmail: string): Promise<void> {
    const now = Date.now();
    const last = this.lastNotifiedAt.get(roomId) ?? 0;
    if (now - last < this.DEBOUNCE_MS) return;
    this.lastNotifiedAt.set(roomId, now);

    try {
      if (!(await this.aliyunDm.isAvailable())) {
        this.logger.debug('邮件集成未启用，跳过离线聊天提醒');
        return;
      }
      const notificationSettings = await this.settings.getSiteNotificationSettings();
      if (!notificationSettings.enabled) {
        this.logger.debug('站点通知已关闭，跳过离线聊天提醒');
        return;
      }
      const recipients = notificationSettings.contact.notifyEmails
        .map((e) => e.trim())
        .filter(Boolean);
      if (recipients.length === 0) return;

      const adminBase = this.config.get<string>('ADMIN_URL')?.replace(/\/$/, '') ?? '';
      const adminUrl = adminBase ? `${adminBase}/chat` : '/chat';
      const subject = `[离线留言] 访客 ${clientEmail} 在会话 ${roomId} 留言`;
      const text = `访客 ${clientEmail} 在会话 ${roomId} 留下了新留言，但当前没有坐席在线。请尽快登录处理：${adminUrl}`;
      const html = `<p>访客 <b>${clientEmail}</b> 在会话 <code>${roomId}</code> 留下了新留言，但当前没有坐席在线。</p><p>请尽快 <a href="${adminUrl}">登录后台处理</a>。</p>`;

      for (const to of recipients) {
        await this.aliyunDm.sendMail({ to, subject, text, html }).catch((err) => {
          this.logger.warn(`离线聊天提醒发送失败 to=${to}: ${(err as Error).message}`);
        });
      }
    } catch (error) {
      this.logger.warn(`离线聊天提醒失败 roomId=${roomId}: ${(error as Error).message}`);
    }
  }
}
