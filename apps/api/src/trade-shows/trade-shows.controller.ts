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
import { TradeShowsService } from "./trade-shows.service";
import { CreateTradeShowDto, UpdateTradeShowDto } from "./dto/trade-show.dto";
import { Public } from "../auth/decorators/public.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { Role, type AuthUser } from "../auth/roles";

@ApiTags("trade-shows")
@Controller("trade-shows")
export class TradeShowsController {
  constructor(private readonly tradeShowsService: TradeShowsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "获取展会列表" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({
    name: "eventType",
    required: false,
    description: "exhibition|seminar|roadshow",
  })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "sortBy", required: false, description: "排序字段，如 title" })
  @ApiQuery({ name: "sortOrder", required: false, description: "asc|desc" })
  findAll(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(12), ParseIntPipe) limit: number,
    @Query("eventType") eventType?: string,
    @Query("search") search?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.tradeShowsService.findAll({
      page,
      limit,
      eventType,
      search,
      sortBy,
      sortOrder,
      includeUnpublished: !!user,
    });
  }

  @Public()
  @Get(":slug")
  @ApiOperation({ summary: "获取展会详情" })
  findOne(@Param("slug") slug: string, @CurrentUser() user?: AuthUser) {
    return this.tradeShowsService.findOne(slug, !!user);
  }

  @Roles(Role.EDITOR, Role.ADMIN)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: "创建展会" })
  create(@Body() dto: CreateTradeShowDto, @CurrentUser() user: AuthUser) {
    return this.tradeShowsService.create(dto, user.id);
  }

  @Roles(Role.EDITOR, Role.ADMIN)
  @ApiBearerAuth()
  @Put(":id")
  @ApiOperation({ summary: "更新展会" })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateTradeShowDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tradeShowsService.update(id, dto, user.id);
  }

  @RequirePermissions("content.delete")
  @ApiBearerAuth()
  @Delete(":id")
  @ApiOperation({ summary: "删除展会" })
  remove(@Param("id") id: string) {
    return this.tradeShowsService.remove(id);
  }
}
