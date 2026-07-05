import { Module } from "@nestjs/common";
import { IntegrationsModule } from "../integrations/integrations.module";
import { SettingsModule } from "../settings/settings.module";
import { NotificationController } from "./notification.controller";
import { NotificationService } from "./notification.service";

@Module({
  imports: [IntegrationsModule, SettingsModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
