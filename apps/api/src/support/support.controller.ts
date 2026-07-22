import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CreateCommentDto, CreateTicketDto, UpdateTicketDto } from './dto/create-ticket.dto';
import { SupportService } from './support.service';

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

@ApiTags('support')
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Public()
  @Post('tickets')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '访客提交工单（无需登录）' })
  async createTicket(@Body() createTicketDto: CreateTicketDto) {
    try {
      return await this.supportService.createTicket(createTicketDto);
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @RequirePermissions('tickets.view')
  @ApiBearerAuth()
  @Get('tickets')
  @ApiOperation({ summary: '工单列表' })
  async getAllTickets(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('category') category?: string,
  ) {
    try {
      return await this.supportService.getAllTickets(
        Number(page),
        Number(limit),
        status,
        priority,
        category,
      );
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @RequirePermissions('tickets.view')
  @ApiBearerAuth()
  @Get('tickets/:ticketId')
  @ApiOperation({ summary: '工单详情' })
  async getTicketById(@Param('ticketId') ticketId: string) {
    try {
      return await this.supportService.getTicketById(ticketId);
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.NOT_FOUND);
    }
  }

  @RequirePermissions('tickets.manage')
  @ApiBearerAuth()
  @Put('tickets/:ticketId')
  @ApiOperation({ summary: '更新工单状态' })
  async updateTicket(
    @Param('ticketId') ticketId: string,
    @Body() updateTicketDto: UpdateTicketDto,
  ) {
    try {
      return await this.supportService.updateTicket(ticketId, updateTicketDto);
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @RequirePermissions('tickets.delete')
  @ApiBearerAuth()
  @Delete('tickets/:ticketId')
  @ApiOperation({ summary: '删除工单' })
  async deleteTicket(@Param('ticketId') ticketId: string) {
    try {
      await this.supportService.deleteTicket(ticketId);
      return { message: 'Ticket deleted successfully' };
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @RequirePermissions('tickets.manage')
  @ApiBearerAuth()
  @Post('tickets/:ticketId/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '添加工单评论' })
  async addComment(
    @Param('ticketId') ticketId: string,
    @Body() createCommentDto: CreateCommentDto,
  ) {
    try {
      return await this.supportService.addComment(ticketId, createCommentDto);
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @RequirePermissions('tickets.view')
  @ApiBearerAuth()
  @Get('tickets/:ticketId/comments')
  @ApiOperation({ summary: '工单评论列表' })
  async getTicketComments(@Param('ticketId') ticketId: string) {
    try {
      return await this.supportService.getTicketComments(ticketId);
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @RequirePermissions('tickets.view')
  @ApiBearerAuth()
  @Get('admin/stats')
  @ApiOperation({ summary: '工单统计' })
  async getAdminStats() {
    try {
      return await this.supportService.getAdminStats();
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }
}
