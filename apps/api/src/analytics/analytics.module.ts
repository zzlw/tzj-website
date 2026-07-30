import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { SecurityModule } from '../security/security.module';
import { SettingsModule } from '../settings/settings.module';
import { AdSpendService } from './ad-spend.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { GrowthMetricsService } from './growth-metrics.service';
import { IpLocationService } from './ip-location.service';

@Module({
  imports: [SettingsModule, IntegrationsModule, SecurityModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, GrowthMetricsService, AdSpendService, IpLocationService],
  // 供灵犀（LingxiModule）工具集复用同口径聚合，保证报表页与 AI 报告数据一致
  exports: [AnalyticsService, GrowthMetricsService, AdSpendService],
})
export class AnalyticsModule {}
