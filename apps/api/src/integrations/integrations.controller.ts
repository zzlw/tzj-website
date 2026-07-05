import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { UpdateIntegrationDto } from "@tzj/types";
import { Public } from "../auth/decorators/public.decorator";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/roles";
import { IntegrationsService } from "./integrations.service";
import { updateIntegrationSchema } from "./integrations.schema";

@ApiTags("integrations")
@ApiBearerAuth()
@Controller("integrations")
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Public()
  @Get("public")
  @ApiOperation({ summary: "C 端公开集成配置（如阿里云验证码 prefix/sceneId）" })
  getPublicConfig() {
    return this.integrationsService.getPublicConfig();
  }

  @RequirePermissions("integrations.view")
  @Get("admin")
  @ApiOperation({ summary: "集成凭证概览（脱敏，含基础设施 env 状态）" })
  getAdminOverview() {
    return this.integrationsService.getAdminOverview();
  }

  @RequirePermissions("integrations.manage")
  @Put(":slug")
  @ApiOperation({ summary: "更新集成配置与加密凭证" })
  update(
    @Param("slug") slug: string,
    @Body() body: UpdateIntegrationDto,
    @CurrentUser() user: AuthUser,
  ) {
    const parsed = updateIntegrationSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.integrationsService.update(slug, parsed.data, user.id);
  }

  @RequirePermissions("integrations.manage")
  @Post(":slug/test")
  @ApiOperation({ summary: "测试集成连接" })
  testConnection(@Param("slug") slug: string) {
    return this.integrationsService.testConnection(slug);
  }
}
