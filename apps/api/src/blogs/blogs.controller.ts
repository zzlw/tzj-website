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
import { BlogsService } from "./blogs.service";
import { CreateBlogDto, UpdateBlogDto } from "./dto/blog.dto";
import { Public } from "../auth/decorators/public.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { Role, type AuthUser } from "../auth/roles";

@ApiTags("blogs")
@Controller("blogs")
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "获取博客列表" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({
    name: "category",
    required: false,
    description: "training_facility|burn_room|modular|practice|industry",
  })
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
    return this.blogsService.findAll({
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
  @ApiOperation({ summary: "获取博客详情" })
  findOne(@Param("slug") slug: string, @CurrentUser() user?: AuthUser) {
    return this.blogsService.findOne(slug, !!user);
  }

  @Roles(Role.EDITOR, Role.ADMIN)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: "创建博客" })
  create(@Body() dto: CreateBlogDto, @CurrentUser() user: AuthUser) {
    return this.blogsService.create(dto, user.id);
  }

  @Roles(Role.EDITOR, Role.ADMIN)
  @ApiBearerAuth()
  @Put(":id")
  @ApiOperation({ summary: "更新博客" })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateBlogDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.blogsService.update(id, dto, user.id);
  }

  @RequirePermissions("content.delete")
  @ApiBearerAuth()
  @Delete(":id")
  @ApiOperation({ summary: "删除博客" })
  remove(@Param("id") id: string) {
    return this.blogsService.remove(id);
  }
}
