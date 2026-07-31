import { Module } from '@nestjs/common';
import { AliyunCaptchaService } from './aliyun-captcha.service';
import { AliyunDmService } from './aliyun-dm.service';
import { BaiduOcpcService } from './baidu-ocpc.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationsService, AliyunCaptchaService, AliyunDmService, BaiduOcpcService],
  exports: [IntegrationsService, AliyunCaptchaService, AliyunDmService, BaiduOcpcService],
})
export class IntegrationsModule {}
