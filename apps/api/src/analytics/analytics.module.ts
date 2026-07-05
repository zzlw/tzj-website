import { Module } from "@nestjs/common";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import { SettingsModule } from "../settings/settings.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { SecurityModule } from "../security/security.module";

@Module({
  imports: [SettingsModule, IntegrationsModule, SecurityModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
