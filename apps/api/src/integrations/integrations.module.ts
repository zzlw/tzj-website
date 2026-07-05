import { Module } from "@nestjs/common";
import { IntegrationsController } from "./integrations.controller";
import { IntegrationsService } from "./integrations.service";
import { AliyunCaptchaService } from "./aliyun-captcha.service";
import { AliyunDmService } from "./aliyun-dm.service";

@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationsService, AliyunCaptchaService, AliyunDmService],
  exports: [IntegrationsService, AliyunCaptchaService, AliyunDmService],
})
export class IntegrationsModule {}
