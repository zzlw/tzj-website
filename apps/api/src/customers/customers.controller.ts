import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthUser } from '../auth/roles';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { CustomersService } from './customers.service';
// biome-ignore lint/style/useImportType: @Body() 校验需要 DTO 类作为运行期元数据
import {
  CreateCustomerDto,
  ImportCustomersDto,
  TransferCustomerDto,
  UpdateCustomerDto,
} from './dto/customer.dto';

function canViewAll(user: AuthUser): boolean {
  return user.role === 'admin' || (user.permissions?.includes('customers.manage') ?? false);
}

function parseScope(v?: string): 'mine' | 'public' | 'all' {
  if (v === 'public' || v === 'all') return v;
  return 'mine';
}

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @RequirePermissions('customers.view', 'customers.manage')
  @ApiBearerAuth()
  @Get('summary')
  @ApiOperation({ summary: '客户池概览计数（私海 / 公海 / 总量）' })
  summary(@CurrentUser() user: AuthUser) {
    return this.customersService.summary(user.id, canViewAll(user));
  }

  @RequirePermissions('customers.view', 'customers.manage')
  @ApiBearerAuth()
  @Get('agents')
  @ApiOperation({ summary: '可接收客户的坐席列表（用于转移）' })
  agents() {
    return this.customersService.listAgents();
  }

  @RequirePermissions('customers.view', 'customers.manage')
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: '客户列表（按 scope 区分私海/公海/全部）' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({
    name: 'scope',
    required: false,
    description: 'mine=我的私海 | public=公海 | all=全部（需 customers.manage）',
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'stage', required: false })
  @ApiQuery({ name: 'level', required: false })
  @ApiQuery({ name: 'source', required: false })
  @ApiQuery({ name: 'customerType', required: false })
  @ApiQuery({
    name: 'channel',
    required: false,
    description: '来源渠道（首触流量归因：direct/organic/paid/…，区别于业务维度的 source）',
  })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
    @Query('scope') scope?: string,
    @Query('search') search?: string,
    @Query('stage') stage?: string,
    @Query('level') level?: string,
    @Query('source') source?: string,
    @Query('customerType') customerType?: string,
    @Query('channel') channel?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.customersService.findAll({
      page,
      limit,
      scope: parseScope(scope),
      canViewAll: canViewAll(user as AuthUser),
      currentUserId: (user as AuthUser).id,
      search,
      stage,
      level,
      source,
      customerType,
      channel,
      sortBy,
      sortOrder,
    });
  }

  @RequirePermissions('customers.view', 'customers.manage')
  @ApiBearerAuth()
  @Get(':id')
  @ApiOperation({ summary: '客户详情' })
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @RequirePermissions('customers.manage')
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: '创建客户（默认归入创建人私海）' })
  create(@Body() dto: CreateCustomerDto, @CurrentUser() user: AuthUser) {
    return this.customersService.create(dto, user.id);
  }

  @RequirePermissions('customers.manage')
  @ApiBearerAuth()
  @Post('import')
  @ApiOperation({ summary: '批量导入客户（CSV 解析后逐条写入，按 scope 归属公海/私海）' })
  importCustomers(@Body() dto: ImportCustomersDto, @CurrentUser() user: AuthUser) {
    return this.customersService.importMany(dto, user.id);
  }

  @RequirePermissions('customers.manage')
  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({ summary: '更新客户' })
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto, @CurrentUser() user: AuthUser) {
    return this.customersService.update(id, dto, user.id);
  }

  @RequirePermissions('customers.delete')
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: '删除客户' })
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }

  @RequirePermissions('customers.manage')
  @ApiBearerAuth()
  @Post(':id/claim')
  @ApiOperation({ summary: '认领（从公海归入本人私海）' })
  claim(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.customersService.claim(id, user.id);
  }

  @RequirePermissions('customers.manage')
  @ApiBearerAuth()
  @Post(':id/release')
  @ApiOperation({ summary: '退回公海' })
  release(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.customersService.release(id, user.id, user.role === 'admin');
  }

  @RequirePermissions('customers.manage')
  @ApiBearerAuth()
  @Post(':id/transfer')
  @ApiOperation({ summary: '转移给其他坐席（归入其私海）' })
  transfer(
    @Param('id') id: string,
    @Body() dto: TransferCustomerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.customersService.transfer(id, dto, user.id, user.role === 'admin');
  }
}
