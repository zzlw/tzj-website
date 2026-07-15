import { Module } from '@nestjs/common';
import { AliyunCaptchaService } from './aliyun-captcha.service';
import { AliyunDmService } from './aliyun-dm.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationsService, AliyunCaptchaService, AliyunDmService],
  exports: [IntegrationsService, AliyunCaptchaService, AliyunDmService],
})
export class IntegrationsModule {}
