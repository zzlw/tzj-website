import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { extractClientIp } from '../common/utils/client-ip';
import { ChatRoomService } from './chat-room.service';
import {
  BatchChatRoomsDto,
  CreateChatRoomDto,
  GetChatRoomsDto,
  PresignAttachmentDto,
  SendMessageDto,
  UpdateChatRoomDto,
} from './dto/chat-room.dto';

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

@Public()
@Controller('chat-rooms')
export class ChatRoomController {
  constructor(private readonly chatRoomService: ChatRoomService) {}

  @Post()
  async createChatRoom(@Req() req: Request, @Body() createChatRoomDto: CreateChatRoomDto) {
    try {
      return await this.chatRoomService.createChatRoom({
        clientEmail: createChatRoomDto.clientEmail,
        clientName: createChatRoomDto.clientName,
        initialMessage: createChatRoomDto.initialMessage,
        clientIp: extractClientIp(req),
        userAgent: createChatRoomDto.userAgent,
        referrer: createChatRoomDto.referrer,
        landingPath: createChatRoomDto.landingPath,
        source: createChatRoomDto.source,
      });
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @Get()
  async getChatRooms(@Query() filters: GetChatRoomsDto) {
    try {
      return await this.chatRoomService.getChatRooms(filters);
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  /** 批量操作：关闭 / 归档 / 软删除（P2/P3 运维） */
  @Post('batch')
  async batchUpdate(@Body() dto: BatchChatRoomsDto) {
    try {
      if (dto.action === 'delete') {
        const count = await this.chatRoomService.softDeleteRooms(dto.roomIds);
        return { action: 'delete', count };
      }
      const count = await this.chatRoomService.batchSetStatus(
        dto.roomIds,
        dto.action === 'archive' ? 'archived' : 'closed',
      );
      return { action: dto.action, count };
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @Get('notifications/counts')
  async getNotificationCounts(
    @Query('userEmail') userEmail?: string,
    @Query('userType') userType?: 'client' | 'agent',
  ) {
    try {
      return await this.chatRoomService.getNotificationCounts(userEmail, userType);
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @Get('unread/count')
  async getUnreadMessageCount(@Query('agentEmail') agentEmail?: string) {
    try {
      const count = await this.chatRoomService.getUnreadMessageCount(agentEmail);
      return { unreadCount: count };
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @Get('stats/overview')
  async getChatRoomStats() {
    try {
      return await this.chatRoomService.getChatRoomStats();
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @Get('client/:clientEmail/recent')
  async getMostRecentChatRoomByClientEmail(@Param('clientEmail') clientEmail: string) {
    try {
      const chatRoom = await this.chatRoomService.getMostRecentChatRoomByClientEmail(clientEmail);
      const canCreateNewRoom = await this.chatRoomService.canClientCreateNewRoom(clientEmail);
      return { room: chatRoom, canCreateNewRoom };
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @Get('client/:clientEmail/history')
  async getAllChatRoomsForClient(@Param('clientEmail') clientEmail: string) {
    try {
      return await this.chatRoomService.getAllChatRoomsForClient(clientEmail);
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @Get('client/:clientEmail')
  async getChatRoomByClientEmail(@Param('clientEmail') clientEmail: string) {
    try {
      return await this.chatRoomService.getChatRoomByClientEmail(clientEmail);
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @Get(':roomId')
  async getChatRoomById(@Param('roomId') roomId: string) {
    try {
      return await this.chatRoomService.getChatRoomById(roomId);
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.NOT_FOUND);
    }
  }

  @Post(':roomId/messages')
  async sendMessage(@Param('roomId') roomId: string, @Body() sendMessageDto: SendMessageDto) {
    try {
      return await this.chatRoomService.sendMessage(roomId, sendMessageDto);
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':roomId/attachments/presign')
  async presignAttachment(@Param('roomId') roomId: string, @Body() dto: PresignAttachmentDto) {
    try {
      return await this.chatRoomService.presignAttachment({ roomId, ...dto });
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @Put(':roomId')
  async updateChatRoom(
    @Param('roomId') roomId: string,
    @Body() updateChatRoomDto: UpdateChatRoomDto,
  ) {
    try {
      return await this.chatRoomService.updateChatRoom(roomId, updateChatRoomDto);
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':roomId/close')
  async closeChatRoom(
    @Param('roomId') roomId: string,
    @Body() body: { closedBy?: string; reason?: string },
  ) {
    try {
      return await this.chatRoomService.closeChatRoom(
        roomId,
        body.closedBy ?? 'system',
        body.reason,
      );
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @Put(':roomId/messages/read')
  async markMessagesAsRead(
    @Param('roomId') roomId: string,
    @Body() body: { userEmail: string; userType: 'client' | 'agent'; messageIds?: string[] },
  ) {
    try {
      return await this.chatRoomService.markMessagesAsReadByUser(
        roomId,
        body.userEmail,
        body.userType,
        body.messageIds,
      );
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @Get(':roomId/unread-count')
  async getUnreadCount(
    @Param('roomId') roomId: string,
    @Query('userEmail') userEmail: string,
    @Query('userType') userType: 'client' | 'agent',
  ) {
    try {
      const count = await this.chatRoomService.getUnreadCountForUser(roomId, userEmail, userType);
      return { unreadCount: count };
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @Put(':roomId/notifications/reset')
  async resetNotificationCount(
    @Param('roomId') roomId: string,
    @Body() body: { userType: 'client' | 'agent' },
  ) {
    try {
      await this.chatRoomService.resetNotificationCount(roomId, body.userType);
      return { message: 'Notification count reset successfully' };
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @Delete(':roomId')
  async deleteChatRoom(@Param('roomId') roomId: string) {
    try {
      await this.chatRoomService.deleteChatRoom(roomId);
      return { message: 'Chat room deleted successfully' };
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }
}
