import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { StorageModule } from '../storage/storage.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaGuardService } from './media-guard.service';
import { WatermarkService } from './watermark.service';

@Module({
  imports: [StorageModule, SettingsModule],
  controllers: [MediaController],
  providers: [MediaService, MediaGuardService, WatermarkService],
})
export class MediaModule {}
