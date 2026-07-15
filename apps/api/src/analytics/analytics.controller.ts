import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { SecurityService } from '../security/security.service';
import { AnalyticsService } from './analytics.service';
import { CollectPageViewDto } from './dto/collect-pageview.dto';
import { IdentifyDto } from './dto/identify.dto';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly securityService: SecurityService,
  ) {}

  @Public()
  @Post('collect')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiOperation({ summary: '采集官网页面浏览（公开，限流）' })
  collect(@Body() dto: CollectPageViewDto, @Req() req: Request) {
    return this.analyticsService.collect(dto, req);
  }

  @Public()
  @Post('identify')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: '识别访客身份（公开，限流）：匿名 → 已知，用于 B 端归并' })
  identify(@Body() dto: IdentifyDto) {
    return this.analyticsService.identify(dto);
  }

  @RequirePermissions('analytics.view')
  @ApiBearerAuth()
  @Get('overview')
  @ApiOperation({ summary: '访客分析概览（PV/UV、趋势、排行）' })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD' })
  overview(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analyticsService.getOverview(from, to);
  }

  @RequirePermissions('analytics.view')
  @ApiBearerAuth()
  @Get('visitors')
  @ApiOperation({ summary: '访客会话归并列表（同一访客多次会话合并为一行）' })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'q', required: false, description: '按姓名/邮箱/电话/公司模糊搜索' })
  listVisitors(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
  ) {
    return this.analyticsService.listVisitors({ page, limit, from, to, q });
  }

  @RequirePermissions('analytics.view')
  @ApiBearerAuth()
  @Get('pages')
  @ApiOperation({ summary: '热门页面列表（分页、排序）' })
  listPages(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.analyticsService.listPages({
      page,
      limit,
      from,
      to,
      sortBy,
      sortOrder,
    });
  }

  @RequirePermissions('analytics.view')
  @ApiBearerAuth()
  @Get('regions')
  @ApiOperation({ summary: '访客地区列表（分页、排序）' })
  listRegions(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.analyticsService.listRegions({
      page,
      limit,
      from,
      to,
      sortBy,
      sortOrder,
    });
  }

  @RequirePermissions('analytics.view')
  @ApiBearerAuth()
  @Get('referrers')
  @ApiOperation({ summary: '流量来源列表（分页、排序）' })
  listReferrers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.analyticsService.listReferrers({
      page,
      limit,
      from,
      to,
      sortBy,
      sortOrder,
    });
  }

  @RequirePermissions('analytics.view')
  @ApiBearerAuth()
  @Get('ip-traffic')
  @ApiOperation({ summary: '按 IP 聚合的访客流量（后台只读）' })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD' })
  listIpTraffic(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.securityService.listIpTraffic({ page, limit, from, to });
  }
}
