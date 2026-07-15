import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { AccessService } from './access.service';
import { CreateAccessRoleDto, UpdateAccessRoleDto } from './dto/role.dto';
import { RolesService } from './roles.service';

@ApiTags('access')
@Controller('access')
@ApiBearerAuth()
@RequirePermissions('access.view')
export class AccessController {
  constructor(
    private readonly accessService: AccessService,
    private readonly rolesService: RolesService,
  ) {}

  @Get('roles')
  @ApiOperation({ summary: '角色列表与权限矩阵' })
  getRoles() {
    return this.accessService.getRolesOverview();
  }

  @Get('roles/options')
  @ApiOperation({ summary: '角色下拉选项（账号分配用）' })
  listOptions() {
    return this.rolesService.listOptions();
  }

  @Post('roles')
  @RequirePermissions('access.manage')
  @ApiOperation({ summary: '创建自定义角色' })
  createRole(@Body() dto: CreateAccessRoleDto) {
    return this.rolesService.create(dto);
  }

  @Put('roles/:id')
  @RequirePermissions('access.manage')
  @ApiOperation({ summary: '更新自定义角色' })
  updateRole(@Param('id') id: string, @Body() dto: UpdateAccessRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @Delete('roles/:id')
  @RequirePermissions('access.manage')
  @ApiOperation({ summary: '删除自定义角色' })
  removeRole(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }
}
