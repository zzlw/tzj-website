import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { SystemService } from './system.service';

@ApiTags('system')
@ApiBearerAuth()
@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @RequirePermissions('system.view')
  @Get('status')
  @ApiOperation({ summary: '系统状态（内存/CPU/磁盘/依赖，仅后台）' })
  getStatus() {
    return this.systemService.getStatus();
  }
}
