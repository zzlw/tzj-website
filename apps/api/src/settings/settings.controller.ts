import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SiteMediaSettings, SiteNotificationSettings, SitePublicSettings } from '@tzj/types';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get('site/public')
  @ApiOperation({ summary: '获取官网公开站点设置（C 端）' })
  getSitePublic() {
    return this.settingsService.getSitePublicSettings();
  }

  @RequirePermissions('settings.manage')
  @ApiBearerAuth()
  @Get('site/public/admin')
  @ApiOperation({ summary: '获取官网站点设置（管理端）' })
  getSitePublicAdmin() {
    return this.settingsService.getSitePublicSettings();
  }

  @RequirePermissions('settings.manage')
  @ApiBearerAuth()
  @Put('site/public')
  @ApiOperation({ summary: '更新官网站点设置' })
  updateSitePublic(@Body() body: SitePublicSettings) {
    return this.settingsService.updateSitePublicSettings(body);
  }

  @RequirePermissions('settings.view', 'settings.manage')
  @ApiBearerAuth()
  @Get('site/notifications')
  @ApiOperation({ summary: '获取邮件通知设置（管理端）' })
  getSiteNotifications() {
    return this.settingsService.getSiteNotificationSettings();
  }

  @RequirePermissions('settings.manage')
  @ApiBearerAuth()
  @Put('site/notifications')
  @ApiOperation({ summary: '更新邮件通知设置' })
  updateSiteNotifications(@Body() body: SiteNotificationSettings) {
    return this.settingsService.updateSiteNotificationSettings(body);
  }

  @RequirePermissions('settings.view', 'settings.manage')
  @ApiBearerAuth()
  @Get('site/media')
  @ApiOperation({ summary: '获取媒体处理设置（管理端）' })
  getSiteMedia() {
    return this.settingsService.getSiteMediaSettings();
  }

  @RequirePermissions('settings.manage')
  @ApiBearerAuth()
  @Put('site/media')
  @ApiOperation({ summary: '更新媒体处理设置（水印等）' })
  updateSiteMedia(@Body() body: SiteMediaSettings) {
    return this.settingsService.updateSiteMediaSettings(body);
  }
}
