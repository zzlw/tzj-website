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
import { CreateNewsDto, UpdateNewsDto } from './dto/news.dto';
import { NewsService } from './news.service';

@ApiTags('news')
@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: '获取新闻列表' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'company|industry|knowledge|equipment',
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'sortBy', required: false, description: '排序字段，如 title' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'asc|desc' })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.newsService.findAll({
      page,
      limit,
      category,
      search,
      sortBy,
      sortOrder,
      includeUnpublished: !!user,
    });
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: '获取新闻详情' })
  findOne(@Param('slug') slug: string, @CurrentUser() user?: AuthUser) {
    return this.newsService.findOne(slug, !!user);
  }

  @RequirePermissions('content.create')
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: '创建新闻' })
  create(@Body() dto: CreateNewsDto, @CurrentUser() user: AuthUser) {
    return this.newsService.create(dto, user.id);
  }

  @RequirePermissions('content.edit')
  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({ summary: '更新新闻' })
  update(@Param('id') id: string, @Body() dto: UpdateNewsDto, @CurrentUser() user: AuthUser) {
    return this.newsService.update(id, dto, user.id);
  }

  @RequirePermissions('content.delete')
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: '删除新闻' })
  remove(@Param('id') id: string) {
    return this.newsService.remove(id);
  }
}
