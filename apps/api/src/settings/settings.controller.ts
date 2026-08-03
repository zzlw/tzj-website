import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  SecurityAuthSettings,
  SiteMediaSettings,
  SiteNotificationSettings,
  SitePublicSettings,
} from '@tzj/types';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/roles';
import { extractClientIp } from '../common/utils/client-ip';
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

  @Public()
  @Get('cache-ttl')
  @ApiOperation({ summary: '获取官网设置缓存 TTL（秒，C 端 web 按此值缓存站点设置；0 = 不缓存）' })
  async getCacheTtl() {
    return { ttl: await this.settingsService.getCacheTtl() };
  }

  @RequirePermissions('settings.view', 'settings.manage')
  @ApiBearerAuth()
  @Get('cache-ttl/admin')
  @ApiOperation({ summary: '获取官网设置缓存 TTL（管理端）' })
  async getCacheTtlAdmin() {
    return { ttl: await this.settingsService.getCacheTtl() };
  }

  @RequirePermissions('settings.manage')
  @ApiBearerAuth()
  @Put('cache-ttl')
  @ApiOperation({ summary: '更新官网设置缓存 TTL（秒，0 = 不缓存，每次访问实时读取）' })
  async updateCacheTtl(@Body() body: { ttl: number }) {
    return { ttl: await this.settingsService.updateCacheTtl(body) };
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

  // 安全策略（强制 2FA 开关）：用 @Roles('admin') 而非 settings.manage，
  // 口径对齐既有 POST /auth/2fa/force-disable（同为安全策略，admin 专属）
  @Roles('admin')
  @ApiBearerAuth()
  @Get('security/auth')
  @ApiOperation({ summary: '获取安全策略设置（强制 2FA 开关，admin 专属）' })
  getSecurityAuth() {
    return this.settingsService.getSecurityAuthSettings();
  }

  @Roles('admin')
  @ApiBearerAuth()
  @Put('security/auth')
  @ApiOperation({ summary: '更新安全策略设置（置 true 需操作者自身已启用 2FA）' })
  updateSecurityAuth(
    @CurrentUser() user: AuthUser,
    @Body() body: SecurityAuthSettings,
    @Req() req: Request & { id?: string },
  ) {
    return this.settingsService.updateSecurityAuthSettings(body, {
      id: user.id,
      ip: extractClientIp(req),
      userAgent: req.headers['user-agent'],
      traceId: req.id,
    });
  }
}
