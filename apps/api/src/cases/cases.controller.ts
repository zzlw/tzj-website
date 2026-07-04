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
import { CasesService } from "./cases.service";
import { CreateCaseDto, UpdateCaseDto } from "./dto/case.dto";
import { Public } from "../auth/decorators/public.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { Role, type AuthUser } from "../auth/roles";

@ApiTags("cases")
@Controller("cases")
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "获取工程案例列表" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "type", required: false, description: "案例类型: military|fire|police|scenic|school|enterprise" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "sortBy", required: false, description: "排序字段，如 title" })
  @ApiQuery({ name: "sortOrder", required: false, description: "asc|desc" })
  findAll(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(12), ParseIntPipe) limit: number,
    @Query("type") type?: string,
    @Query("search") search?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.casesService.findAll({
      page,
      limit,
      caseType: type,
      search,
      sortBy,
      sortOrder,
      includeUnpublished: !!user,
    });
  }

  @Public()
  @Get(":slug")
  @ApiOperation({ summary: "获取案例详情" })
  findOne(@Param("slug") slug: string, @CurrentUser() user?: AuthUser) {
    return this.casesService.findOne(slug, !!user);
  }

  @Roles(Role.EDITOR, Role.ADMIN)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: "创建案例" })
  create(@Body() dto: CreateCaseDto, @CurrentUser() user: AuthUser) {
    return this.casesService.create(dto, user.id);
  }

  @Roles(Role.EDITOR, Role.ADMIN)
  @ApiBearerAuth()
  @Put(":id")
  @ApiOperation({ summary: "更新案例" })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateCaseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.casesService.update(id, dto, user.id);
  }

  @RequirePermissions("content.delete")
  @ApiBearerAuth()
  @Delete(":id")
  @ApiOperation({ summary: "删除案例" })
  remove(@Param("id") id: string) {
    return this.casesService.remove(id);
  }
}
