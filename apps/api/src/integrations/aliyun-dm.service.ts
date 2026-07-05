import { Injectable, Logger } from "@nestjs/common";
import Dm20151123, { SingleSendMailRequest } from "@alicloud/dm20151123";
import { $OpenApiUtil } from "@alicloud/openapi-core";
import { IntegrationsService } from "./integrations.service";

const SLUG = "aliyun-directmail";

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

@Injectable()
export class AliyunDmService {
  private readonly logger = new Logger(AliyunDmService.name);

  constructor(private readonly integrations: IntegrationsService) {}

  async isAvailable(): Promise<boolean> {
    return this.integrations.isActive(SLUG);
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    const accessKeyId = await this.integrations.resolveSecret(SLUG, "accessKeyId");
    const accessKeySecret = await this.integrations.resolveSecret(SLUG, "accessKeySecret");
    const accountName = await this.integrations.resolveConfig(SLUG, "accountName");
    const fromAlias =
      (await this.integrations.resolveConfig(SLUG, "fromAlias"))?.trim() || "拓之迹官网";
    const region =
      (await this.integrations.resolveConfig(SLUG, "region"))?.trim() || "cn-hangzhou";

    if (!accessKeyId || !accessKeySecret || !accountName) {
      throw new Error("阿里云邮件推送未完整配置");
    }

    const client = new Dm20151123(
      new $OpenApiUtil.Config({
        accessKeyId,
        accessKeySecret,
        endpoint: "dm.aliyuncs.com",
        regionId: region,
      }),
    );

    const request = new SingleSendMailRequest({
      accountName,
      addressType: 1,
      toAddress: options.to,
      subject: options.subject,
      htmlBody: options.html,
      textBody: options.text,
      fromAlias,
      replyToAddress: options.replyTo,
    });

    try {
      await client.singleSendMail(request);
    } catch (error) {
      this.logger.warn(`阿里云邮件发送失败: ${(error as Error).message}`);
      throw error;
    }
  }
}
