import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { SecurityModule } from '../security/security.module';
import { SettingsModule } from '../settings/settings.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { IpLocationService } from './ip-location.service';

@Module({
  imports: [SettingsModule, IntegrationsModule, SecurityModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, IpLocationService],
})
export class AnalyticsModule {}
