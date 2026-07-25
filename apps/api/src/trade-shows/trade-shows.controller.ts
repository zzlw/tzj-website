import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
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
import { PreviewTokenService } from '../preview/preview-token.service';
import { CreateTradeShowDto, UpdateTradeShowDto } from './dto/trade-show.dto';
import { TradeShowsService } from './trade-shows.service';

@ApiTags('trade-shows')
@Controller('trade-shows')
export class TradeShowsController {
  constructor(
    private readonly tradeShowsService: TradeShowsService,
    private readonly previewTokens: PreviewTokenService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: '获取展会列表' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({
    name: 'eventType',
    required: false,
    description: 'exhibition|seminar|roadshow',
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'sortBy', required: false, description: '排序字段，如 title' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'asc|desc' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'draft|published|archived（仅登录后台可按状态过滤）',
  })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
    @Query('eventType') eventType?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('status') status?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.tradeShowsService.findAll({
      page,
      limit,
      eventType,
      search,
      sortBy,
      sortOrder,
      status,
      includeUnpublished: !!user,
    });
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: '获取展会详情' })
  @ApiQuery({ name: 'previewToken', required: false, description: '草稿预览令牌（后台生成）' })
  async findOne(
    @Param('slug') slug: string,
    @Query('previewToken') previewToken?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    const includeUnpublished =
      !!user || (await this.previewTokens.verify(previewToken, 'trade-shows', slug));
    return this.tradeShowsService.findOne(slug, includeUnpublished);
  }

  @RequirePermissions('content.create')
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: '创建展会' })
  create(@Body() dto: CreateTradeShowDto, @CurrentUser() user: AuthUser) {
    return this.tradeShowsService.create(dto, user.id);
  }

  @RequirePermissions('content.edit')
  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({ summary: '更新展会' })
  update(@Param('id') id: string, @Body() dto: UpdateTradeShowDto, @CurrentUser() user: AuthUser) {
    return this.tradeShowsService.update(id, dto, user.id);
  }

  @RequirePermissions('content.delete')
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: '删除展会' })
  remove(@Param('id') id: string) {
    return this.tradeShowsService.remove(id);
  }
}
