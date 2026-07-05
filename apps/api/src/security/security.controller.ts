import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/roles";
import { IpBanService } from "./ip-ban.service";
import { SecurityService } from "./security.service";
import { CreateBlockedIpDto } from "./dto/create-blocked-ip.dto";

@ApiTags("security")
@Controller("security")
export class SecurityController {
  constructor(
    private readonly ipBanService: IpBanService,
    private readonly securityService: SecurityService,
  ) {}

  @RequirePermissions("security.view")
  @ApiBearerAuth()
  @Get("ip-traffic")
  @ApiOperation({ summary: "按 IP 聚合的访问流量（脱敏，用于识别异常访客）" })
  @ApiQuery({ name: "from", required: false, description: "YYYY-MM-DD" })
  @ApiQuery({ name: "to", required: false, description: "YYYY-MM-DD" })
  listIpTraffic(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("top", new DefaultValuePipe(100), ParseIntPipe) top?: number,
  ) {
    return this.securityService.listIpTraffic({ page, limit, from, to, top });
  }

  @RequirePermissions("security.view")
  @ApiBearerAuth()
  @Get("blocked-ips")
  @ApiOperation({ summary: "IP 封禁列表（分页）" })
  listBlockedIps(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.ipBanService.listBlocked(page, limit);
  }

  @RequirePermissions("security.manage")
  @ApiBearerAuth()
  @Post("blocked-ips")
  @ApiOperation({ summary: "封禁 IP（哈希存储，静默丢弃后续访问）" })
  blockIp(@Body() dto: CreateBlockedIpDto, @CurrentUser() user: AuthUser) {
    return this.ipBanService.blockIp(dto, user.id);
  }

  @RequirePermissions("security.manage")
  @ApiBearerAuth()
  @Delete("blocked-ips/:id")
  @ApiOperation({ summary: "解除 IP 封禁" })
  unblockIp(@Param("id") id: string) {
    return this.ipBanService.unblock(id);
  }
}
