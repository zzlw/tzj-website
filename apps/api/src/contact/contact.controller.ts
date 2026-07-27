import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthUser } from '../auth/roles';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { AliyunCaptchaService } from '../integrations/aliyun-captcha.service';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { ContactService } from './contact.service';
// biome-ignore lint/style/useImportType: @Body() 校验需要 DTO 类作为运行期元数据
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(
    private readonly contactService: ContactService,
    private readonly aliyunCaptchaService: AliyunCaptchaService,
  ) {}

  @RequirePermissions('contacts.view', 'contacts.manage')
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: '获取联系信息列表' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'isRead', required: false })
  @ApiQuery({ name: 'isHandled', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'source', required: false, description: '来源: website|admin|api' })
  @ApiQuery({
    name: 'channel',
    required: false,
    description: '首触来源渠道: direct|organic|paid|social|email|referral|other',
  })
  @ApiQuery({ name: 'converted', required: false, description: '是否已转化为客户: true|false' })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false })
  @ApiQuery({ name: 'deleted', required: false, description: '回收站视图: true 仅看已软删' })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('isRead') isRead?: string,
    @Query('isHandled') isHandled?: string,
    @Query('search') search?: string,
    @Query('source') source?: string,
    @Query('channel') channel?: string,
    @Query('converted') converted?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('deleted') deleted?: string,
  ) {
    return this.contactService.findAll({
      page,
      limit,
      isRead: isRead !== undefined ? isRead === 'true' : undefined,
      isHandled: isHandled !== undefined ? isHandled === 'true' : undefined,
      search,
      source,
      channel,
      converted: converted !== undefined ? converted === 'true' : undefined,
      sortBy,
      sortOrder,
      deleted: deleted === 'true' || deleted === '1',
    });
  }

  @RequirePermissions('contacts.view', 'contacts.manage')
  @ApiBearerAuth()
  @Get(':id/visitor-profile')
  @ApiOperation({ summary: '询盘访客画像（IP 重解析地区 + 运营商 + 站内行为/营销归因）' })
  getVisitorProfile(@Param('id') id: string) {
    return this.contactService.getVisitorProfile(id);
  }

  @RequirePermissions('contacts.view', 'contacts.manage')
  @ApiBearerAuth()
  @Get(':id')
  @ApiOperation({ summary: '获取联系信息详情' })
  findOne(@Param('id') id: string) {
    return this.contactService.findOne(id);
  }

  @Public()
  @Post()
  @ApiOperation({ summary: '提交联系信息（官网留言）' })
  async create(
    @Body() dto: CreateContactDto,
    @Headers('x-captcha-verify-param') captchaVerifyParam: string | undefined,
  ) {
    await this.aliyunCaptchaService.verify(captchaVerifyParam);
    return this.contactService.create(dto);
  }

  @RequirePermissions('contacts.manage')
  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({ summary: '更新联系信息（标记已读/已处理）' })
  update(@Param('id') id: string, @Body() dto: UpdateContactDto, @CurrentUser() user: AuthUser) {
    return this.contactService.update(id, dto, user.id);
  }

  @RequirePermissions('contacts.delete')
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: '删除联系信息（软删除，移入回收站）' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.contactService.remove(id, user.id);
  }

  @RequirePermissions('contacts.delete')
  @ApiBearerAuth()
  @Post(':id/restore')
  @ApiOperation({ summary: '从回收站恢复询盘' })
  restore(@Param('id') id: string) {
    return this.contactService.restore(id);
  }

  @RequirePermissions('contacts.delete')
  @ApiBearerAuth()
  @Delete(':id/purge')
  @ApiOperation({ summary: '永久删除询盘（仅管理员，需先在回收站中）' })
  purge(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    // 物理清除不新增权限点，收敛为管理员专属（见 docs/design/deletion-strategy.md §3.4）
    if (user.role !== 'admin') {
      throw new ForbiddenException('永久删除仅限管理员操作');
    }
    return this.contactService.purge(id, user.id);
  }
}
