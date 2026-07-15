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
import { Public } from '../auth/decorators/public.decorator';
import { CreateCommentDto, CreateTicketDto, UpdateTicketDto } from './dto/create-ticket.dto';
import { SupportService } from './support.service';

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Public()
  @Post('tickets')
  @HttpCode(HttpStatus.CREATED)
  async createTicket(@Body() createTicketDto: CreateTicketDto) {
    try {
      return await this.supportService.createTicket(createTicketDto);
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @Get('tickets')
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

  @Get('tickets/:ticketId')
  async getTicketById(@Param('ticketId') ticketId: string) {
    try {
      return await this.supportService.getTicketById(ticketId);
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.NOT_FOUND);
    }
  }

  @Put('tickets/:ticketId')
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

  @Delete('tickets/:ticketId')
  async deleteTicket(@Param('ticketId') ticketId: string) {
    try {
      await this.supportService.deleteTicket(ticketId);
      return { message: 'Ticket deleted successfully' };
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @Post('tickets/:ticketId/comments')
  @HttpCode(HttpStatus.CREATED)
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

  @Get('tickets/:ticketId/comments')
  async getTicketComments(@Param('ticketId') ticketId: string) {
    try {
      return await this.supportService.getTicketComments(ticketId);
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @Get('admin/stats')
  async getAdminStats() {
    try {
      return await this.supportService.getAdminStats();
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }
}
