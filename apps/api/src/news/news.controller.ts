import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from "@nestjs/swagger";
import { NewsService } from "./news.service";
import { CreateNewsDto, UpdateNewsDto } from "./dto/news.dto";
import { Public } from "../auth/decorators/public.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { Role, type AuthUser } from "../auth/roles";

@ApiTags("news")
@Controller("news")
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "获取新闻列表" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "category", required: false, description: "company|industry|knowledge|equipment" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "sortBy", required: false, description: "排序字段，如 title" })
  @ApiQuery({ name: "sortOrder", required: false, description: "asc|desc" })
  findAll(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(12), ParseIntPipe) limit: number,
    @Query("category") category?: string,
    @Query("search") search?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: string,
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
  @Get(":slug")
  @ApiOperation({ summary: "获取新闻详情" })
  findOne(@Param("slug") slug: string, @CurrentUser() user?: AuthUser) {
    return this.newsService.findOne(slug, !!user);
  }

  @Roles(Role.EDITOR, Role.ADMIN)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: "创建新闻" })
  create(@Body() dto: CreateNewsDto, @CurrentUser() user: AuthUser) {
    return this.newsService.create(dto, user.id);
  }

  @Roles(Role.EDITOR, Role.ADMIN)
  @ApiBearerAuth()
  @Put(":id")
  @ApiOperation({ summary: "更新新闻" })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateNewsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.newsService.update(id, dto, user.id);
  }

  @RequirePermissions("content.delete")
  @ApiBearerAuth()
  @Delete(":id")
  @ApiOperation({ summary: "删除新闻" })
  remove(@Param("id") id: string) {
    return this.newsService.remove(id);
  }
}
