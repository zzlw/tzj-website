import { Module } from '@nestjs/common';
import { IpLocationService } from '../analytics/ip-location.service';
import { IntegrationsModule } from '../integrations/integrations.module';
import { NotificationModule } from '../notifications/notification.module';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';

@Module({
  imports: [IntegrationsModule, NotificationModule],
  controllers: [ContactController],
  // IpLocationService 无构造依赖，直接在本模块提供一份（复用「访客分析」的 IP 重解析能力），
  // 避免为单一服务 import 整个 AnalyticsModule 带来跨模块耦合。
  providers: [ContactService, IpLocationService],
  exports: [ContactService],
})
export class ContactModule {}
