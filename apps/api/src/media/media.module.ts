import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { StorageModule } from '../storage/storage.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaGuardService } from './media-guard.service';
import { WatermarkService } from './watermark.service';
import { WatermarkArchiveCleanupService } from './watermark-archive-cleanup.service';
import { WatermarkReburnService } from './watermark-reburn.service';

@Module({
  imports: [StorageModule, SettingsModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    MediaGuardService,
    WatermarkService,
    WatermarkArchiveCleanupService,
    WatermarkReburnService,
  ],
})
export class MediaModule {}
