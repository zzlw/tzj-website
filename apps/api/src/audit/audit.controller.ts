import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { AuditService } from "./audit.service";

@ApiTags("audit-logs")
@Controller("audit-logs")
@RequirePermissions("audit.view")
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: "操作日志列表（只读）" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "userId", required: false })
  @ApiQuery({ name: "resource", required: false })
  @ApiQuery({ name: "action", required: false })
  @ApiQuery({ name: "from", required: false, description: "开始日期 YYYY-MM-DD" })
  @ApiQuery({ name: "to", required: false, description: "结束日期 YYYY-MM-DD" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "sortBy", required: false, description: "排序字段" })
  @ApiQuery({ name: "sortOrder", required: false, description: "asc|desc" })
  findAll(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("userId") userId?: string,
    @Query("resource") resource?: string,
    @Query("action") action?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("search") search?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: string,
  ) {
    return this.auditService.findAll({
      page,
      limit: Math.min(limit, 100),
      userId,
      resource,
      action,
      from,
      to,
      search,
      sortBy,
      sortOrder,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "操作日志详情（只读）" })
  findOne(@Param("id") id: string) {
    return this.auditService.findOne(id);
  }
}
