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
import { ContactService } from "./contact.service";
import { CreateContactDto, UpdateContactDto } from "./dto/contact.dto";
import { Public } from "../auth/decorators/public.decorator";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/roles";

@ApiTags("contact")
@Controller("contact")
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @RequirePermissions("contacts.view", "contacts.manage")
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: "获取联系信息列表" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "isRead", required: false })
  @ApiQuery({ name: "isHandled", required: false })
  findAll(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("isRead") isRead?: string,
    @Query("isHandled") isHandled?: string,
  ) {
    return this.contactService.findAll({
      page,
      limit,
      isRead: isRead !== undefined ? isRead === "true" : undefined,
      isHandled: isHandled !== undefined ? isHandled === "true" : undefined,
    });
  }

  @RequirePermissions("contacts.view", "contacts.manage")
  @ApiBearerAuth()
  @Get(":id")
  @ApiOperation({ summary: "获取联系信息详情" })
  findOne(@Param("id") id: string) {
    return this.contactService.findOne(id);
  }

  @Public()
  @Post()
  @ApiOperation({ summary: "提交联系信息（官网留言）" })
  create(@Body() dto: CreateContactDto) {
    return this.contactService.create(dto);
  }

  @RequirePermissions("contacts.manage")
  @ApiBearerAuth()
  @Put(":id")
  @ApiOperation({ summary: "更新联系信息（标记已读/已处理）" })
  update(@Param("id") id: string, @Body() dto: UpdateContactDto, @CurrentUser() user: AuthUser) {
    return this.contactService.update(id, dto, user.id);
  }

  @RequirePermissions("contacts.delete")
  @ApiBearerAuth()
  @Delete(":id")
  @ApiOperation({ summary: "删除联系信息" })
  remove(@Param("id") id: string) {
    return this.contactService.remove(id);
  }
}
