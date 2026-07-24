import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
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
import { AliyunCaptchaService } from '../integrations/aliyun-captcha.service';
import { ContactService } from './contact.service';
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
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('isRead') isRead?: string,
    @Query('isHandled') isHandled?: string,
  ) {
    return this.contactService.findAll({
      page,
      limit,
      isRead: isRead !== undefined ? isRead === 'true' : undefined,
      isHandled: isHandled !== undefined ? isHandled === 'true' : undefined,
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
  @ApiOperation({ summary: '删除联系信息' })
  remove(@Param('id') id: string) {
    return this.contactService.remove(id);
  }
}
