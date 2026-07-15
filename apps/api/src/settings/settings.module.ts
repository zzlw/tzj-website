import { Module } from '@nestjs/common';
import { FaviconController } from '../site-settings/favicon.controller';
import { FaviconService } from '../site-settings/favicon.service';
import { StorageModule } from '../storage/storage.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [StorageModule],
  controllers: [SettingsController, FaviconController],
  providers: [SettingsService, FaviconService],
  exports: [SettingsService],
})
export class SettingsModule {}
