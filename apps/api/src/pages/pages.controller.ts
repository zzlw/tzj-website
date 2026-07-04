import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { PagesService } from "./pages.service";
import { CreatePageDto, UpdatePageDto } from "./dto/page.dto";
import { Public } from "../auth/decorators/public.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { Role } from "../auth/roles";

@ApiTags("pages")
@Controller("pages")
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "获取所有页面" })
  findAll() {
    return this.pagesService.findAll();
  }

  @Public()
  @Get(":slug")
  @ApiOperation({ summary: "获取页面详情" })
  findOne(@Param("slug") slug: string) {
    return this.pagesService.findOne(slug);
  }

  @Roles(Role.EDITOR, Role.ADMIN)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: "创建页面" })
  create(@Body() dto: CreatePageDto) {
    return this.pagesService.create(dto);
  }

  @Roles(Role.EDITOR, Role.ADMIN)
  @ApiBearerAuth()
  @Put(":id")
  @ApiOperation({ summary: "更新页面" })
  update(@Param("id") id: string, @Body() dto: UpdatePageDto) {
    return this.pagesService.update(id, dto);
  }

  @RequirePermissions("content.delete")
  @ApiBearerAuth()
  @Delete(":id")
  @ApiOperation({ summary: "删除页面" })
  remove(@Param("id") id: string) {
    return this.pagesService.remove(id);
  }
}
