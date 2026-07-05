import { Module } from "@nestjs/common";
import { ContactController } from "./contact.controller";
import { ContactService } from "./contact.service";
import { IntegrationsModule } from "../integrations/integrations.module";
import { NotificationModule } from "../notifications/notification.module";

@Module({
  imports: [IntegrationsModule, NotificationModule],
  controllers: [ContactController],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactModule {}
