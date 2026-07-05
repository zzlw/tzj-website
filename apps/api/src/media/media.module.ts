import { Module } from "@nestjs/common";
import { MediaService } from "./media.service";
import { MediaGuardService } from "./media-guard.service";
import { MediaController } from "./media.controller";
import { WatermarkService } from "./watermark.service";
import { StorageModule } from "../storage/storage.module";
import { SettingsModule } from "../settings/settings.module";

@Module({
  imports: [StorageModule, SettingsModule],
  controllers: [MediaController],
  providers: [MediaService, MediaGuardService, WatermarkService],
})
export class MediaModule {}
