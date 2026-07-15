import { Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ChatRoomService } from './chat-room.service';

const ChatRoomStatus = {
  ACTIVE: 'active',
  WAITING: 'waiting',
  CLOSED: 'closed',
} as const;

/** 用户在线状态三态 */
export type PresenceStatus = 'online' | 'away' | 'offline';

/** 阈值（毫秒）：超过 AWAY_MS 无心跳 → away；超过 OFFLINE_MS → offline */
const AWAY_MS = 60_000;
const OFFLINE_MS = 90_000;
/** disconnect 后延迟广播 offline 的宽限期，避免 tab 刷新/网络闪断造成状态抖动 */
const DISCONNECT_GRACE_MS = 30_000;

interface PresenceEntry {
  userEmail: string;
  userType: 'client' | 'agent';
  status: PresenceStatus;
  lastSeen: number;
  sockets: Set<string>;
}

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: (origin, callback) => {
      const origins = (process.env.CORS_ORIGINS || 'http://localhost:3001,http://localhost:3002')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);

      const allowedPatterns = [
        /^http:\/\/localhost:\d+$/,
        /^http:\/\/127\.0\.0\.1:\d+$/,
        /^file:\/\//,
      ];

      if (!origin || origin === 'null') {
        return callback(null, true);
      }
      if (origins.includes(origin)) {
        return callback(null, true);
      }
      if (allowedPatterns.some((pattern) => pattern.test(origin))) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // socket.id → 用户信息（用于通过 socket 反查用户）
  private connectedUsers = new Map<
    string,
    { socket: Socket; userEmail: string; userType: 'client' | 'agent' }
  >();

  // `${userEmail}:${userType}` → presence（聚合多 socket，以用户为键）
  private presence = new Map<string, PresenceEntry>();

  // disconnect 宽限期定时器：key → timer
  private offlineTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly chatRoomService: ChatRoomService) {}

  // ── 工具方法 ──────────────────────────────────────────────

  private presenceKey(userEmail: string, userType: string) {
    return `${userEmail}:${userType}`;
  }

  /** 登记 socket + 用户到 presence 系统 */
  private registerSocket(socket: Socket, userEmail: string, userType: 'client' | 'agent') {
    this.connectedUsers.set(socket.id, { socket, userEmail, userType });

    const key = this.presenceKey(userEmail, userType);

    // 取消该用户的 disconnect 离线宽限定时器（如果设置了）
    const timer = this.offlineTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.offlineTimers.delete(key);
    }

    let entry = this.presence.get(key);
    if (!entry) {
      // 坐席初始状态为 offline，需显式切换为在线（业内最佳实践）
      const initialStatus: PresenceStatus = userType === 'agent' ? 'offline' : 'online';
      entry = {
        userEmail,
        userType,
        status: initialStatus,
        lastSeen: Date.now(),
        sockets: new Set(),
      };
      this.presence.set(key, entry);
    }
    entry.sockets.add(socket.id);
    entry.lastSeen = Date.now();

    // 新 socket 接入不自动变更状态：坐席状态由显式 set-presence 驱动
    // 仅客户端首次注册时广播初始状态
    if (userType === 'client') {
      this.updatePresence(key, 'online');
    }
  }

  /** 移除 socket；该用户无剩余 socket 时启动离线宽限期，避免 tab 刷新/网络闪断抖动 */
  private unregisterSocket(socketId: string) {
    const userInfo = this.connectedUsers.get(socketId);
    this.connectedUsers.delete(socketId);
    if (!userInfo) return null;

    const key = this.presenceKey(userInfo.userEmail, userInfo.userType);
    const entry = this.presence.get(key);
    if (!entry) return userInfo;

    entry.sockets.delete(socketId);
    if (entry.sockets.size === 0) {
      // 宽限期：延时 30s 再广播 offline。若期间新 socket 接入（tab 刷新重连），
      // registerSocket 会取消此定时器，用户不会经历 online→offline→online 的状态抖动。
      const timer = this.offlineTimers.get(key);
      if (timer) clearTimeout(timer);
      this.offlineTimers.set(
        key,
        setTimeout(() => {
          this.offlineTimers.delete(key);
          // 再次确认无 socket 残留（可能在宽限期内又断开）
          const latest = this.presence.get(key);
          if (latest && latest.sockets.size === 0) {
            this.updatePresence(key, 'offline');
          }
        }, DISCONNECT_GRACE_MS),
      );
    }
    return userInfo;
  }

  /** 更新 presence 状态，变化时广播给相关方 */
  private updatePresence(key: string, newStatus: PresenceStatus) {
    const entry = this.presence.get(key);
    if (!entry) return;
    if (entry.status === newStatus) return;

    const oldStatus = entry.status;
    entry.status = newStatus;
    if (newStatus === 'online') {
      entry.lastSeen = Date.now();
    }

    this.logger.log(`Presence: ${entry.userEmail} (${entry.userType}) ${oldStatus} → ${newStatus}`);

    // 1. 全局广播（覆盖 agent 刚连接还没 join room 的场景）
    this.server.emit('presence-changed', {
      userEmail: entry.userEmail,
      userType: entry.userType,
      status: newStatus,
    });

    // 坐席可用性变化 → 同步广播给所有端（访客需要诚实的「是否有人在线」状态）
    if (entry.userType === 'agent') {
      this.broadcastAgentAvailability();
      this.broadcastAgentPresence();
    }

    // 2. 广播给该用户所在的所有 room
    for (const socketId of entry.sockets) {
      const info = this.connectedUsers.get(socketId);
      if (!info) continue;
      for (const room of info.socket.rooms) {
        if (room !== info.socket.id) {
          this.server.to(room).emit('presence-changed', {
            userEmail: entry.userEmail,
            userType: entry.userType,
            status: newStatus,
          });
        }
      }
    }

    // 客户端状态变化 → 刷新 agent 会话列表（列表项含 clientPresence）
    if (entry.userType === 'client') {
      void this.broadcastRoomListUpdate();
    }
  }

  /** 给 rooms 数组注入 clientPresence 字段 */
  private enrichRoomsWithPresence(rooms: any[]): any[] {
    return rooms.map((room) => {
      const key = this.presenceKey(room.clientEmail, 'client');
      const entry = this.presence.get(key);
      return {
        ...room,
        clientPresence: entry?.status ?? 'offline',
      };
    });
  }

  /** 查询某用户当前 presence */
  getPresence(userEmail: string, userType: 'client' | 'agent'): PresenceStatus {
    return this.presence.get(this.presenceKey(userEmail, userType))?.status ?? 'offline';
  }

  /** 聚合客服在线信息（面向 C 端单一「品牌客服」人设 + 多坐席细化）：
   *  - status：有任一坐席 online → online；无 online 但存在 away → away；
   *            全部 offline / 无坐席 → offline
   *  - onlineCount / awayCount：分别统计在线 / 离开坐席数（多坐席时展示「N 位客服在线」）
   *  - lastOnlineAt：所有坐席中最近一次活跃的时间戳，用于「最后在线时间」提示
   *    （online 坐席即 now；offline 坐席保留其断线前的 lastSeen，≈最后在线时刻） */
  getAggregateAgentPresenceInfo(): {
    status: PresenceStatus;
    onlineCount: number;
    awayCount: number;
    lastOnlineAt: number | null;
  } {
    let anyOnline = false;
    let anyAway = false;
    let onlineCount = 0;
    let awayCount = 0;
    let lastOnlineAt: number | null = null;
    for (const entry of this.presence.values()) {
      if (entry.userType !== 'agent') continue;
      if (lastOnlineAt === null || entry.lastSeen > lastOnlineAt) {
        lastOnlineAt = entry.lastSeen;
      }
      if (entry.status === 'online') {
        anyOnline = true;
        onlineCount++;
      } else if (entry.status === 'away') {
        anyAway = true;
        awayCount++;
      }
    }
    const status: PresenceStatus = anyOnline ? 'online' : anyAway ? 'away' : 'offline';
    return { status, onlineCount, awayCount, lastOnlineAt };
  }

  /** 坐席在线数变化时，向所有已连接端广播（访客据此诚实呈现可用性、多坐席数与最后在线时刻） */
  private broadcastAgentAvailability() {
    const info = this.getAggregateAgentPresenceInfo();
    this.server.emit('agents-online', {
      online: info.onlineCount,
      away: info.awayCount,
      lastOnlineAt: info.lastOnlineAt,
    });
  }

  /** 坐席状态变化 → 向所有端广播当前「聚合客服在线状态」，
   *  使已连接的访客实时、准确地呈现在线/离开/离线（而非仅依赖状态变更事件）。 */
  private broadcastAgentPresence() {
    const info = this.getAggregateAgentPresenceInfo();
    this.server.emit('presence-changed', {
      userEmail: 'agent@tzj.com',
      userType: 'agent',
      status: info.status,
      onlineCount: info.onlineCount,
      awayCount: info.awayCount,
      lastOnlineAt: info.lastOnlineAt,
    });
  }

  // ── 生命周期 ──────────────────────────────────────────────

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    const agentInfo = this.getAggregateAgentPresenceInfo();
    // 连接即下发当前坐席在线数，避免访客冷启动期间被误判为「有人在线」
    client.emit('agents-online', {
      online: agentInfo.onlineCount,
      away: agentInfo.awayCount,
      lastOnlineAt: agentInfo.lastOnlineAt,
    });
    // 同时下发当前「聚合客服在线状态」快照（含多坐席数与最后在线时刻）：
    // 保证新访客首屏即呈现真实在线/离开/离线与多坐席细化，而非乐观默认。
    client.emit('presence-changed', {
      userEmail: 'agent@tzj.com',
      userType: 'agent',
      status: agentInfo.status,
      onlineCount: agentInfo.onlineCount,
      awayCount: agentInfo.awayCount,
      lastOnlineAt: agentInfo.lastOnlineAt,
    });
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const userInfo = this.unregisterSocket(client.id);

    const rooms = Array.from(client.rooms);
    rooms.forEach((room) => {
      if (room !== client.id) {
        client.leave(room);
        this.server.to(room).emit('user-left', {
          socketId: client.id,
          userEmail: userInfo?.userEmail,
          userType: userInfo?.userType,
        });
      }
    });
  }

  // ── 定时扫描：心跳超时 → away / offline ────────────────────

  @Interval(15_000)
  scanPresence() {
    const now = Date.now();
    for (const [key, entry] of this.presence) {
      if (entry.sockets.size === 0) {
        if (entry.status !== 'offline') {
          this.updatePresence(key, 'offline');
        }
        continue;
      }
      const elapsed = now - entry.lastSeen;
      if (elapsed > OFFLINE_MS && entry.status !== 'offline') {
        this.updatePresence(key, 'offline');
      } else if (elapsed > AWAY_MS && elapsed <= OFFLINE_MS && entry.status === 'online') {
        this.updatePresence(key, 'away');
      }
    }
  }

  // ── 定时维护：闲置关闭 + 超期归档（P2） ────────────────────
  @Interval(60_000)
  async runAutoMaintain() {
    try {
      const res = await this.chatRoomService.autoMaintain();
      if (res.closed > 0 || res.archived > 0) {
        this.logger.log(`Auto-maintain: closed=${res.closed} archived=${res.archived}`);
        await this.broadcastRoomListUpdate();
      }
    } catch (error) {
      this.logger.error('Auto-maintain failed', error);
    }
  }

  // ── 事件处理 ──────────────────────────────────────────────

  @SubscribeMessage('register-agent')
  async handleRegisterAgent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userEmail: string },
  ) {
    try {
      const { userEmail } = data;
      this.logger.log(`Agent ${userEmail} registering for room list updates`);
      this.registerSocket(client, userEmail, 'agent');
      client.emit('agent-registered', { userEmail });
      await this.sendRoomListToAgent(client, userEmail);
    } catch (error) {
      this.logger.error('Error registering agent:', error);
      client.emit('error', { message: 'Failed to register agent' });
    }
  }

  async sendRoomListToAgent(socket: Socket, userEmail: string) {
    try {
      const result = await this.chatRoomService.getChatRooms({});
      const enriched = this.enrichRoomsWithPresence(result.rooms);
      this.logger.log(`Sending room list to agent ${userEmail}: ${enriched.length} rooms`);
      socket.emit('room-list-updated', { rooms: enriched });
    } catch (error) {
      this.logger.error('Error sending room list to agent:', error);
    }
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { roomId: string; userEmail: string; userType: 'client' | 'agent' },
  ) {
    try {
      const { roomId, userEmail, userType } = data;
      this.logger.log(`User ${userEmail} (${userType}) joining room ${roomId}`);
      this.registerSocket(client, userEmail, userType);
      await client.join(roomId);
      client.to(roomId).emit('user-joined', { userEmail, userType });
      client.emit('joined-room', { roomId, userEmail, userType });

      // 把己方 presence 推给 room 内对方
      const myPresence = this.getPresence(userEmail, userType);
      client.to(roomId).emit('presence-changed', {
        userEmail,
        userType,
        status: myPresence,
      });

      if (userType === 'agent') {
        await this.chatRoomService.updateChatRoom(roomId, {
          status: ChatRoomStatus.ACTIVE,
          assignedAgentEmail: userEmail,
        });
        this.server.to(roomId).emit('room-status-changed', {
          roomId,
          status: 'active',
          assignedAgentEmail: userEmail,
        });
      }
    } catch (error) {
      this.logger.error('Error joining room:', error);
      client.emit('error', { message: 'Failed to join room' });
    }
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    try {
      const { roomId } = data;
      const userInfo = this.connectedUsers.get(client.id);
      if (userInfo) {
        this.logger.log(`User ${userInfo.userEmail} leaving room ${roomId}`);
        await client.leave(roomId);
        client.to(roomId).emit('user-left', {
          userEmail: userInfo.userEmail,
          userType: userInfo.userType,
        });
        client.emit('left-room', { roomId });
      }
    } catch (error) {
      this.logger.error('Error leaving room:', error);
      client.emit('error', { message: 'Failed to leave room' });
    }
  }

  @SubscribeMessage('send-message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      content: string;
      sender: 'client' | 'agent';
      senderEmail: string;
      attachments?: string[];
    },
  ) {
    try {
      const { roomId, content, sender, senderEmail, attachments } = data;
      this.logger.log(`Message from ${senderEmail} in room ${roomId}: ${content}`);

      // 发消息也算活跃，刷新 lastSeen + 恢复 online
      const key = this.presenceKey(senderEmail, sender);
      const entry = this.presence.get(key);
      if (entry) {
        entry.lastSeen = Date.now();
        if (entry.status !== 'online') {
          this.updatePresence(key, 'online');
        }
      }

      const updatedRoom = await this.chatRoomService.sendMessage(roomId, {
        content,
        sender,
        senderEmail,
        attachments,
      });

      const latestMessage = updatedRoom.messages[updatedRoom.messages.length - 1];

      this.server.to(roomId).emit('new-message', {
        message: latestMessage,
        room: {
          roomId: updatedRoom.roomId,
          status: updatedRoom.status,
          assignedAgentEmail: updatedRoom.assignedAgentEmail,
          lastActivity: updatedRoom.lastActivity,
          unreadCountForClient: updatedRoom.unreadCountForClient,
          unreadCountForAgent: updatedRoom.unreadCountForAgent,
        },
      });

      await this.broadcastNotificationCounts();
      await this.broadcastRoomListUpdate();
    } catch (error) {
      this.logger.error('Error sending message:', error);
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  @SubscribeMessage('mark-messages-read')
  async handleMarkMessagesRead(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      userEmail: string;
      userType: 'client' | 'agent';
      messageIds?: string[];
    },
  ) {
    try {
      const { roomId, userEmail, userType, messageIds } = data;
      this.logger.log(`User ${userEmail} (${userType}) marking messages as read in room ${roomId}`);

      const updatedRoom = await this.chatRoomService.markMessagesAsReadByUser(
        roomId,
        userEmail,
        userType,
        messageIds,
      );

      this.server.to(roomId).emit('messages-read', {
        roomId,
        userEmail,
        userType,
        messageIds,
        room: {
          roomId: updatedRoom.roomId,
          unreadCountForClient: updatedRoom.unreadCountForClient,
          unreadCountForAgent: updatedRoom.unreadCountForAgent,
          lastReadByClient: updatedRoom.lastReadByClient,
          lastReadByAgent: updatedRoom.lastReadByAgent,
        },
      });

      await this.broadcastNotificationCounts();
      await this.broadcastRoomListUpdate();
    } catch (error) {
      this.logger.error('Error marking messages as read:', error);
      client.emit('error', { message: 'Failed to mark messages as read' });
    }
  }

  @SubscribeMessage('get-notification-counts')
  async handleGetNotificationCounts(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userEmail: string; userType: 'client' | 'agent' },
  ) {
    try {
      const { userEmail, userType } = data;
      const counts = await this.chatRoomService.getNotificationCounts(userEmail, userType);
      client.emit('notification-counts', {
        userEmail,
        userType,
        ...counts,
      });
    } catch (error) {
      this.logger.error('Error getting notification counts:', error);
      client.emit('error', { message: 'Failed to get notification counts' });
    }
  }

  @SubscribeMessage('reset-notification-count')
  async handleResetNotificationCount(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userType: 'client' | 'agent' },
  ) {
    try {
      const { roomId, userType } = data;
      await this.chatRoomService.resetNotificationCount(roomId, userType);
      client.emit('notification-count-reset', { roomId, userType });
      await this.broadcastNotificationCounts();
    } catch (error) {
      this.logger.error('Error resetting notification count:', error);
      client.emit('error', { message: 'Failed to reset notification count' });
    }
  }

  @SubscribeMessage('update-room-status')
  async handleUpdateRoomStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { roomId: string; status: string; assignedAgentEmail?: string },
  ) {
    try {
      const { roomId, status, assignedAgentEmail } = data;
      const userInfo = this.connectedUsers.get(client.id);

      if (!userInfo || userInfo.userType !== 'agent') {
        client.emit('error', { message: 'Only agents can update room status' });
        return;
      }

      this.logger.log(`Agent ${userInfo.userEmail} updating room ${roomId} status to ${status}`);

      let chatRoomStatus: string;
      switch (status) {
        case 'active':
          chatRoomStatus = ChatRoomStatus.ACTIVE;
          break;
        case 'waiting':
          chatRoomStatus = ChatRoomStatus.WAITING;
          break;
        case 'closed':
          chatRoomStatus = ChatRoomStatus.CLOSED;
          break;
        default:
          chatRoomStatus = ChatRoomStatus.WAITING;
      }

      const updateData: any = { status: chatRoomStatus };
      if (assignedAgentEmail) {
        updateData.assignedAgentEmail = assignedAgentEmail;
      }
      if (status === 'closed') {
        updateData.closedAt = new Date();
      }

      await this.chatRoomService.updateChatRoom(roomId, updateData);

      this.server.to(roomId).emit('room-status-changed', {
        roomId,
        status,
        assignedAgentEmail,
        closedAt: status === 'closed' ? new Date() : undefined,
      });

      await this.broadcastRoomListUpdate();
    } catch (error) {
      this.logger.error('Error updating room status:', error);
      client.emit('error', { message: 'Failed to update room status' });
    }
  }

  @SubscribeMessage('get-room-info')
  async handleGetRoomInfo(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    try {
      const { roomId } = data;
      const room = await this.chatRoomService.getChatRoomById(roomId);
      if (room) {
        client.emit('room-info', room);
      } else {
        client.emit('error', { message: 'Room not found' });
      }
    } catch (error) {
      this.logger.error('Error getting room info:', error);
      client.emit('error', { message: 'Failed to get room info' });
    }
  }

  // ── Presence 专用事件 ─────────────────────────────────────

  /** 客户端心跳：每 30s 发一次，服务端刷新 lastSeen */
  @SubscribeMessage('heartbeat')
  handleHeartbeat(@ConnectedSocket() client: Socket) {
    const userInfo = this.connectedUsers.get(client.id);
    if (!userInfo) return;

    const key = this.presenceKey(userInfo.userEmail, userInfo.userType);
    const entry = this.presence.get(key);
    if (!entry) return;

    // 心跳仅刷新「最后活跃时间」，用于连接超时判定；
    // 不再据此把状态硬改为 online —— 否则会覆盖坐席手动选择的「离开/离线」。
    // 状态切换统一由 set-presence 显式驱动。
    entry.lastSeen = Date.now();
  }

  /** 客户端主动报告 idle（标签页切到后台 / 无操作） */
  @SubscribeMessage('user-idle')
  handleUserIdle(@ConnectedSocket() client: Socket) {
    const userInfo = this.connectedUsers.get(client.id);
    if (!userInfo) return;
    const key = this.presenceKey(userInfo.userEmail, userInfo.userType);
    this.updatePresence(key, 'away');
  }

  /** 查询某用户 presence */
  @SubscribeMessage('get-presence')
  handleGetPresence(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userEmail: string; userType: 'client' | 'agent' },
  ) {
    const status = this.getPresence(data.userEmail, data.userType);
    client.emit('presence-changed', {
      userEmail: data.userEmail,
      userType: data.userType,
      status,
    });
  }

  /** 坐席主动切换自身在线状态（在线/离开/离线）。
   *  由 B 端状态切换器经 set-presence 上报；服务端据已连接 socket 的身份更新内存
   *  presence 并广播聚合态，使 C 端访客实时、准确地看到真实在线/离线。
   *  身份取自连接上下文，客户端无法伪造他人状态。 */
  @SubscribeMessage('set-presence')
  handleSetPresence(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { status: PresenceStatus },
  ) {
    const userInfo = this.connectedUsers.get(client.id);
    if (!userInfo) return;
    if (data?.status !== 'online' && data?.status !== 'away' && data?.status !== 'offline') {
      return;
    }
    const key = this.presenceKey(userInfo.userEmail, userInfo.userType);
    this.updatePresence(key, data.status);
  }

  // ── 广播 ──────────────────────────────────────────────────

  async broadcastRoomListUpdate() {
    try {
      const result = await this.chatRoomService.getChatRooms({});
      const enriched = this.enrichRoomsWithPresence(result.rooms);
      let agentCount = 0;
      this.connectedUsers.forEach((userInfo) => {
        if (userInfo.userType === 'agent') {
          agentCount++;
          userInfo.socket.emit('room-list-updated', { rooms: enriched });
        }
      });
      this.logger.log(`Broadcasted room list update to ${agentCount} agents`);
    } catch (error) {
      this.logger.error('Error broadcasting room list update:', error);
    }
  }

  async broadcastNotificationCounts() {
    try {
      const uniqueUsers = new Map<string, { userEmail: string; userType: 'client' | 'agent' }>();
      this.connectedUsers.forEach((userInfo) => {
        const key = `${userInfo.userEmail}-${userInfo.userType}`;
        uniqueUsers.set(key, {
          userEmail: userInfo.userEmail,
          userType: userInfo.userType,
        });
      });

      for (const [, userInfo] of uniqueUsers) {
        const counts = await this.chatRoomService.getNotificationCounts(
          userInfo.userEmail,
          userInfo.userType,
        );
        this.connectedUsers.forEach((connectedUser) => {
          if (
            connectedUser.userEmail === userInfo.userEmail &&
            connectedUser.userType === userInfo.userType
          ) {
            connectedUser.socket.emit('notification-counts-updated', {
              userEmail: userInfo.userEmail,
              userType: userInfo.userType,
              ...counts,
            });
          }
        });
      }
    } catch (error) {
      this.logger.error('Error broadcasting notification counts:', error);
    }
  }
}
