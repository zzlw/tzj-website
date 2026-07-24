import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthUser } from '../auth/roles';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { RolesService } from '../access/roles.service';
import { extractClientIp } from '../common/utils/client-ip';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { ChatAuthService } from './chat-auth.service';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { ChatGateway } from './chat.gateway';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { ChatPresenceStore } from './chat-presence.store';
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

@ApiTags('chat-rooms')
@Controller('chat-rooms')
export class ChatRoomController {
  constructor(
    private readonly chatRoomService: ChatRoomService,
    private readonly chatAuth: ChatAuthService,
    private readonly rolesService: RolesService,
    private readonly presence: ChatPresenceStore,
    private readonly gateway: ChatGateway,
  ) {}

  @Public()
  @Post()
  @ApiOperation({ summary: '访客创建聊天室（无需登录）' })
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
        visitorId: createChatRoomDto.visitorId,
      });
      // 自动分配成功时立即刷新坐席端会话列表（业内最佳实践：新会话即时推送到坐席工作台，
      // 而非等周期性刷新）；未分配（无可用坐席）时同样刷新，让坐席看到 waiting 队列新增。
      void this.gateway.broadcastRoomListUpdate();
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
  @Public()
  @Post('visitor-token')
  @ApiOperation({ summary: '访客重连换取 token' })
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
  @ApiOperation({ summary: '坐席兑换 chat token' })
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

  /**
   * 坐席可用性（公开）：访客端在 socket 连接前即可获知客服在线状态，
   * 避免「有客服在线却显示离线」的体验问题。
   */
  @Public()
  @Get('agent-availability')
  @ApiOperation({ summary: '坐席可用性（访客公开）' })
  async agentAvailability() {
    const agents = await this.presence.getAgentSummaries();
    let online = 0;
    let away = 0;
    let lastOnlineAt: number | null = null;
    for (const a of agents) {
      if (lastOnlineAt === null || (a.lastSeen ?? 0) > lastOnlineAt)
        lastOnlineAt = a.lastSeen ?? null;
      if (a.socketCount <= 0) continue;
      if (a.status === 'online') online++;
      else if (a.status === 'away') away++;
    }
    return { online, away, lastOnlineAt };
  }

  @RequirePermissions('chat.view')
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: '聊天室列表（管理端）' })
  async getChatRooms(@Query() filters: GetChatRoomsDto) {
    try {
      return await this.chatRoomService.getChatRooms(filters);
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  /** 批量操作：关闭 / 归档 / 软删除（P2/P3 运维） */
  @RequirePermissions('chat.manage')
  @ApiBearerAuth()
  @Post('batch')
  @ApiOperation({ summary: '批量操作聊天室' })
  async batchUpdate(@Req() req: Request, @Body() dto: BatchChatRoomsDto) {
    try {
      const user = (req as { user?: AuthUser }).user;
      // 业内最佳实践：删除操作需更高权限（chat.delete），普通客服仅有 chat.manage
      if (dto.action === 'delete') {
        const perms = user ? await this.rolesService.getPermissionsForSlug(user.role) : [];
        if (!perms.includes('chat.delete')) {
          throw new ForbiddenException('删除会话需要 chat.delete 权限');
        }
        const count = await this.chatRoomService.softDeleteRooms(dto.roomIds);
        return { action: 'delete', count };
      }

      if (dto.action === 'close') {
        // 批量关闭与单会话关闭走同一路径（closeRoomAndNotify）：
        // ① 每个会话写入「会话已关闭」系统消息（审计轨迹）
        // ② 实时广播 new-message + room-status-changed → 访客端即时进入关闭态
        // ③ 释放坐席容量，触发等待队列自动派单
        // 此前用裸 updateMany：无系统消息、无广播 → 访客无感知、继续发消息导致会话被重开。
        const closedBy = user?.username ?? 'system';
        let count = 0;
        for (const roomId of dto.roomIds) {
          try {
            await this.gateway.closeRoomAndNotify(roomId, closedBy);
            count++;
          } catch {
            // 单个房间失败（如不存在）跳过，继续处理其余
          }
        }
        await this.gateway.broadcastRoomListUpdate();
        void this.gateway.drainWaitingQueue();
        return { action: 'close', count };
      }

      // 归档：纯内务操作（仅对已关闭会话），无需访客端通知
      const count = await this.chatRoomService.batchSetStatus(dto.roomIds, 'archived');
      return { action: dto.action, count };
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @RequirePermissions('chat.view')
  @ApiBearerAuth()
  @Get('notifications/counts')
  @ApiOperation({ summary: '通知计数' })
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

  @RequirePermissions('chat.view')
  @ApiBearerAuth()
  @Get('unread/count')
  @ApiOperation({ summary: '未读消息数' })
  async getUnreadMessageCount(@Query('agentEmail') agentEmail?: string) {
    try {
      const count = await this.chatRoomService.getUnreadMessageCount(agentEmail);
      return { unreadCount: count };
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @RequirePermissions('chat.view')
  @ApiBearerAuth()
  @Get('stats/overview')
  @ApiOperation({ summary: '聊天统计概览' })
  async getChatRoomStats() {
    try {
      return await this.chatRoomService.getChatRoomStats();
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @Public()
  @Get('client/:clientEmail/recent')
  @ApiOperation({ summary: '访客最近聊天室' })
  async getMostRecentChatRoomByClientEmail(@Param('clientEmail') clientEmail: string) {
    try {
      const chatRoom = await this.chatRoomService.getMostRecentChatRoomByClientEmail(clientEmail);
      const canCreateNewRoom = await this.chatRoomService.canClientCreateNewRoom(clientEmail);
      return { room: chatRoom, canCreateNewRoom };
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @Public()
  @Get('client/:clientEmail/history')
  @ApiOperation({ summary: '访客历史聊天室' })
  async getAllChatRoomsForClient(@Param('clientEmail') clientEmail: string) {
    try {
      return await this.chatRoomService.getAllChatRoomsForClient(clientEmail);
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @Public()
  @Get('client/:clientEmail')
  @ApiOperation({ summary: '访客聊天室查询' })
  async getChatRoomByClientEmail(@Param('clientEmail') clientEmail: string) {
    try {
      return await this.chatRoomService.getChatRoomByClientEmail(clientEmail);
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * 访客获取自己的会话详情（含消息）。
   * 公开端点：凭 clientEmail + roomId 双重校验归属，防止越权读取他人会话。
   * 此前访客端复用管理端 GET :roomId（需 chat.view 权限）→ 匿名 401 →
   * 刷新后历史消息拉不回、HTTP 同步安全网全部静默失败。
   */
  @Public()
  @Get('client/:clientEmail/rooms/:roomId')
  @ApiOperation({ summary: '访客会话详情（含消息，校验归属）' })
  async getVisitorRoomById(
    @Param('clientEmail') clientEmail: string,
    @Param('roomId') roomId: string,
  ) {
    try {
      const room = await this.chatRoomService.getChatRoomById(roomId);
      if (room.clientEmail !== clientEmail) {
        throw new HttpException('无权访问该会话', HttpStatus.FORBIDDEN);
      }
      return room;
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(errMsg(e), HttpStatus.NOT_FOUND);
    }
  }

  @RequirePermissions('chat.view')
  @ApiBearerAuth()
  @Get(':roomId/visitor-profile')
  @ApiOperation({ summary: '访客档案（IP 重解析地区 + 运营商 + 站内行为/营销归因）' })
  async getVisitorProfile(@Param('roomId') roomId: string) {
    try {
      return await this.chatRoomService.getVisitorProfile(roomId);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(errMsg(e), HttpStatus.NOT_FOUND);
    }
  }

  @RequirePermissions('chat.view')
  @ApiBearerAuth()
  @Get(':roomId')
  @ApiOperation({ summary: '聊天室详情' })
  async getChatRoomById(@Param('roomId') roomId: string) {
    try {
      return await this.chatRoomService.getChatRoomById(roomId);
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.NOT_FOUND);
    }
  }

  @Public()
  @Post(':roomId/messages')
  @ApiOperation({ summary: '发送消息（访客/坐席）' })
  async sendMessage(@Param('roomId') roomId: string, @Body() sendMessageDto: SendMessageDto) {
    try {
      return await this.chatRoomService.sendMessage(roomId, sendMessageDto);
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @Public()
  @Post(':roomId/attachments/presign')
  @ApiOperation({ summary: '附件预签名' })
  async presignAttachment(@Param('roomId') roomId: string, @Body() dto: PresignAttachmentDto) {
    try {
      return await this.chatRoomService.presignAttachment({ roomId, ...dto });
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }

  @RequirePermissions('chat.manage')
  @ApiBearerAuth()
  @Put(':roomId')
  @ApiOperation({ summary: '更新聊天室' })
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

  @RequirePermissions('chat.manage')
  @ApiBearerAuth()
  @Post(':roomId/close')
  @ApiOperation({ summary: '关闭聊天室' })
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

  @Public()
  @Put(':roomId/messages/read')
  @ApiOperation({ summary: '标记消息已读' })
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

  @Public()
  @Get(':roomId/unread-count')
  @ApiOperation({ summary: '未读消息数（单房间）' })
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

  @Public()
  @Put(':roomId/notifications/reset')
  @ApiOperation({ summary: '重置通知计数' })
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

  @RequirePermissions('chat.delete')
  @ApiBearerAuth()
  @Delete(':roomId')
  @ApiOperation({ summary: '删除聊天室' })
  async deleteChatRoom(@Param('roomId') roomId: string) {
    try {
      await this.chatRoomService.deleteChatRoom(roomId);
      return { message: 'Chat room deleted successfully' };
    } catch (e) {
      throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
    }
  }
}
