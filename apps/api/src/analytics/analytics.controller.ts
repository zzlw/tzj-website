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
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { SecurityService } from '../security/security.service';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { AnalyticsService } from './analytics.service';
// 注意：DTO 必须值导入（非 import type）。@Body() 的校验依赖
// emitDecoratorMetadata 在运行时解析出真实类（design:paramtypes）；import type 会被擦除。
// biome-ignore lint/style/useImportType: NestJS 校验需要 DTO 作为运行期值（design:paramtypes）
import { CollectPageViewDto } from './dto/collect-pageview.dto';
// biome-ignore lint/style/useImportType: NestJS 校验需要 DTO 作为运行期值（design:paramtypes）
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
  @ApiQuery({
    name: 'granularity',
    required: false,
    description: '趋势粒度 hour|day|week|month（缺省/非法时后端按日期跨度自动选择）',
  })
  overview(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('granularity') granularity?: string,
  ) {
    return this.analyticsService.getOverview(from, to, granularity);
  }

  @RequirePermissions('analytics.view')
  @ApiBearerAuth()
  @Get('sources')
  @ApiOperation({ summary: '营销归因（渠道分组/广告系列/来源排行）' })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD' })
  sources(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analyticsService.getSources(from, to);
  }

  @RequirePermissions('analytics.view')
  @ApiBearerAuth()
  @Get('visitors')
  @ApiOperation({ summary: '访客会话归并列表（同一访客多次会话合并为一行）' })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({
    name: 'q',
    required: false,
    description: '按姓名/邮箱/电话/公司/访客ID/地区模糊搜索',
  })
  @ApiQuery({
    name: 'channel',
    required: false,
    description: '来源渠道（direct/organic/paid/social/email/referral/other）',
  })
  @ApiQuery({
    name: 'deviceType',
    required: false,
    description: '设备类型（desktop/mobile/tablet）',
  })
  @ApiQuery({
    name: 'identified',
    required: false,
    description: '身份状态（true=已识别 / false=匿名）',
  })
  @ApiQuery({ name: 'keyPage', required: false, description: '关键页触达（contact/case/any）' })
  @ApiQuery({
    name: 'converted',
    required: false,
    description: '转化状态（true=已转客户 / false=未转化）',
  })
  listVisitors(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('channel') channel?: string,
    @Query('deviceType') deviceType?: string,
    @Query('identified') identified?: string,
    @Query('keyPage') keyPage?: string,
    @Query('converted') converted?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.analyticsService.listVisitors({
      page,
      limit,
      from,
      to,
      q,
      channel,
      deviceType,
      identified,
      keyPage,
      converted,
      sortBy,
      sortOrder,
    });
  }

  @RequirePermissions('analytics.view')
  @ApiBearerAuth()
  @Get('visitors/export')
  @ApiOperation({
    summary: '「按访客」全量导出（同 listVisitors 筛选/排序，去分页上限 5000，附转化标签）',
  })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'channel', required: false })
  @ApiQuery({ name: 'deviceType', required: false })
  @ApiQuery({ name: 'identified', required: false })
  @ApiQuery({ name: 'keyPage', required: false })
  @ApiQuery({ name: 'converted', required: false })
  exportVisitors(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('channel') channel?: string,
    @Query('deviceType') deviceType?: string,
    @Query('identified') identified?: string,
    @Query('keyPage') keyPage?: string,
    @Query('converted') converted?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.analyticsService.exportVisitors({
      from,
      to,
      q,
      channel,
      deviceType,
      identified,
      keyPage,
      converted,
      sortBy,
      sortOrder,
    });
  }

  @RequirePermissions('analytics.view')
  @ApiBearerAuth()
  @Get('visitor-activity')
  @ApiOperation({ summary: '单个访客的浏览行为时间线（按会话分组，读取现有 PageView）' })
  @ApiQuery({ name: 'visitorId', required: true })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD' })
  getVisitorActivity(
    @Query('visitorId') visitorId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getVisitorActivity(visitorId, { from, to });
  }

  @RequirePermissions('analytics.view')
  @ApiBearerAuth()
  @Get('ip-activity')
  @ApiOperation({ summary: '单个 IP（ipHash）的浏览行为时间线（供访客明细下钻）' })
  @ApiQuery({ name: 'ipHash', required: true })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD' })
  getIpActivity(
    @Query('ipHash') ipHash: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getIpVisitorActivity(ipHash, { from, to });
  }

  @RequirePermissions('analytics.view')
  @ApiBearerAuth()
  @Get('visitor-inquiries')
  @ApiOperation({ summary: '按 visitorId 归并的询盘列表（供人物抽屉「询盘」tab）' })
  @ApiQuery({ name: 'visitorId', required: true })
  getVisitorInquiries(@Query('visitorId') visitorId: string) {
    return this.analyticsService.getVisitorInquiries(visitorId);
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
  @Get('visitor-details')
  @ApiOperation({ summary: '按 IP 聚合的访客明细（地区/IP/来源合并，读取时重解析地区）' })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({
    name: 'q',
    required: false,
    description: '按 IP/地区/城市/国家/浏览器/系统/引荐域名模糊搜索',
  })
  @ApiQuery({
    name: 'channel',
    required: false,
    description: '来源渠道（direct/organic/paid/social/email/referral/other）',
  })
  @ApiQuery({
    name: 'deviceType',
    required: false,
    description: '设备类型（desktop/mobile/tablet）',
  })
  listVisitorDetails(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('channel') channel?: string,
    @Query('deviceType') deviceType?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.analyticsService.listVisitorDetails({
      page,
      limit,
      from,
      to,
      q,
      channel,
      deviceType,
      sortBy,
      sortOrder,
    });
  }

  @RequirePermissions('analytics.view')
  @ApiBearerAuth()
  @Get('visitor-details/export')
  @ApiOperation({
    summary: '「按 IP」全量导出（同 listVisitorDetails 筛选/排序，去分页上限 5000）',
  })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'channel', required: false })
  @ApiQuery({ name: 'deviceType', required: false })
  exportVisitorDetails(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('channel') channel?: string,
    @Query('deviceType') deviceType?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.analyticsService.exportVisitorDetails({
      from,
      to,
      q,
      channel,
      deviceType,
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
