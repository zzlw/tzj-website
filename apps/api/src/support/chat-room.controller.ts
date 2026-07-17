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
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { ChatAuthService } from './chat-auth.service';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { ChatRoomService } from './chat-room.service';
// 注意：DTO 必须值导入（非 import type）。@Body()/@Query() 的校验依赖
// emitDecoratorMetadata 在运行时解析出真实类（design:paramtypes）；import type 会被擦除，
// 导致 NestJS 校验退化为 Object，所有字段被 forbidNonWhitelisted 判为「不应存在」。
// biome-ignore lint/style/useImportType: NestJS 校验需要 DTO 作为运行期值（design:paramtypes）
import {
  BatchChatRoomsDto,
  CreateChatRoomDto,
  GetChatRoomsDto,
  PresignAttachmentDto,
  SendMessageDto,
  UpdateChatRoomDto,
  VisitorTokenDto,
} from './dto/chat-room.dto';

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

@Public()
@Controller('chat-rooms')
export class ChatRoomController {
  constructor(
    private readonly chatRoomService: ChatRoomService,
    private readonly chatAuth: ChatAuthService,
  ) {}

  @Post()
  async createChatRoom(@Req() req: Request, @Body() createChatRoomDto: CreateChatRoomDto) {
    try {
      const room = await this.chatRoomService.createChatRoom({
        clientEmail: createChatRoomDto.clientEmail,
        clientName: createChatRoomDto.clientName,
        initialMessage: createChatRoomDto.initialMessage,
        clientIp: extractClientIp(req),
        userAgent: createChatRoomDto.userAgent,
        referrer: createChatRoomDto.referrer,
        landingPath: createChatRoomDto.landingPath,
        source: createChatRoomDto.source,
      });
      // 签发访客 chat token（P0 C1）：访客凭此令牌通过握手鉴权，身份由服务端推导，
      // 杜绝客户端自报身份。前端存储该 token 用于 socket 连接与刷新重连。
      const token = this.chatAuth.issueClientToken(room.roomId, room.clientEmail);
      return { ...room, token };
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * 访客重连换 token（P0 C1）：凭 roomId + clientEmail（须匹配房间持有者）换取短期 chat token。
   * 公开端点：访客无登录态，但必须证明其知道 roomId + 对应邮箱，否则无法冒领他人会话令牌。
   */
  @Post('visitor-token')
  async visitorToken(@Body() dto: VisitorTokenDto) {
    try {
      const room = await this.chatRoomService.getChatRoomById(dto.roomId);
      if (room.clientEmail !== dto.clientEmail) {
        throw new HttpException('无权获取该会话令牌', HttpStatus.FORBIDDEN);
      }
      const token = this.chatAuth.issueClientToken(room.roomId, room.clientEmail);
      return { token, roomId: room.roomId, clientEmail: room.clientEmail };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * 坐席 chat token 兑换（P0 C1）：用业务系统 access token 换取聊天作用域令牌。
   * 公开端点——令牌合法性由服务端用 JWT_SECRET 校验（仅 type==='access' 可兑换），
   * 坐席身份由此确立，无法被伪造。
   */
  @Public()
  @Post('token')
  async agentToken(@Req() req: Request) {
    try {
      const header = req.headers['authorization'];
      if (!header || !header.startsWith('Bearer ')) {
        throw new HttpException('缺少访问令牌', HttpStatus.UNAUTHORIZED);
      }
      const accessToken = header.slice('Bearer '.length).trim();
      const result = this.chatAuth.exchangeAgentToken(accessToken);
      return result;
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(errMsg(e), HttpStatus.UNAUTHORIZED);
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
