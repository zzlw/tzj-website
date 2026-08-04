import { Module } from '@nestjs/common';
import { AliyunCaptchaService } from './aliyun-captcha.service';
import { BaiduOcpcService } from './baidu-ocpc.service';
import { ExmailSmtpService } from './exmail-smtp.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationsService, AliyunCaptchaService, ExmailSmtpService, BaiduOcpcService],
  exports: [IntegrationsService, AliyunCaptchaService, ExmailSmtpService, BaiduOcpcService],
})
export class IntegrationsModule {}
