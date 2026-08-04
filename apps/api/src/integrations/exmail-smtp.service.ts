import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { IntegrationsService } from './integrations.service';

const SLUG = 'aliyun-exmail';

/** 阿里邮箱 SMTP 服务器（已查证唯一可用：80/587 未开放、25 被 ECS 封禁） */
const SMTP_HOST = 'smtp.qiye.aliyun.com';
const SMTP_PORT = 465;

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class ExmailSmtpService {
  private readonly logger = new Logger(ExmailSmtpService.name);

  constructor(private readonly integrations: IntegrationsService) {}

  async isAvailable(): Promise<boolean> {
    return this.integrations.isActive(SLUG);
  }

  private async createTransport() {
    const accountName = await this.integrations.resolveConfig(SLUG, 'accountName');
    const smtpPassword = await this.integrations.resolveSecret(SLUG, 'smtpPassword');
    const fromAlias =
      (await this.integrations.resolveConfig(SLUG, 'fromAlias'))?.trim() || '拓之迹官网';

    if (!accountName || !smtpPassword) {
      throw new Error('阿里企业邮箱 SMTP 未完整配置');
    }

    return {
      transport: nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: true,
        connectionTimeout: 10_000,
        socketTimeout: 15_000,
        auth: { user: accountName, pass: smtpPassword },
      }),
      from: `"${fromAlias}" <${accountName}>`,
    };
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    const { transport, from } = await this.createTransport();
    try {
      await transport.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
    } catch (error) {
      // 日志只记主机/账号/错误码，绝不打印 smtpPassword
      this.logger.warn(
        `阿里企业邮箱 SMTP 发送失败 host=${SMTP_HOST} account=${from}: ${(error as Error).message}`,
      );
      throw error;
    } finally {
      transport.close();
    }
  }

  /** 「测试连接」探活：真实 SMTP 握手 + 认证，失败返回可读原因 */
  async verify(): Promise<{ ok: boolean; message: string }> {
    try {
      const { transport } = await this.createTransport();
      try {
        await transport.verify();
        return { ok: true, message: `连接成功（${SMTP_HOST}:${SMTP_PORT}，认证通过）` };
      } finally {
        transport.close();
      }
    } catch (error) {
      const message = (error as Error).message;
      if (/535|526|auth/i.test(message)) {
        return { ok: false, message: '认证失败：请核对账号与三方客户端安全密码' };
      }
      if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(message)) {
        return { ok: false, message: `无法连接 ${SMTP_HOST}:${SMTP_PORT}，请检查网络与端口` };
      }
      return { ok: false, message: `SMTP 连接失败：${message}` };
    }
  }
}
