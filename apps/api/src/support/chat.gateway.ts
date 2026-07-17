import { Inject, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { createAdapter } from '@socket.io/redis-adapter';
import type { RedisClientType } from 'redis';
import type { Server, Socket } from 'socket.io';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { ChatAuthService } from './chat-auth.service';
import type { ChatTokenPayload } from './chat-auth.service';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { ChatPresenceStore } from './chat-presence.store';
import type { PresenceStatus } from './chat-presence.store';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { ChatRoomService } from './chat-room.service';
import type { ChatRoomListItem, ChatRoomResult } from './chat-room.service';

const ChatRoomStatus = {
  ACTIVE: 'active',
  WAITING: 'waiting',
  CLOSED: 'closed',
} as const;

/** 阈值（毫秒）：超过 AWAY_MS 无心跳 → away；超过 OFFLINE_MS → offline */
const AWAY_MS = 60_000;
const OFFLINE_MS = 90_000;
/** 重连宽限期：agent 在此时间内重连（如刷新页面）视为短暂中断，恢复在线状态 */
const RECONNECT_GRACE_MS = 60_000;

/** 单条消息长度上限（P2 M2，与 ChatRoomService 保持一致） */
const MAX_MESSAGE_LENGTH = 4000;
/** 每 socket 每分钟最多发送消息数（P2 M2 限流） */
const RATE_LIMIT_PER_MINUTE = 30;
const RATE_WINDOW_MS = 60_000;
/** 输入指示节流：同一 socket 同一房间每 1s 最多转发一次（P1 H2） */
const TYPING_THROTTLE_MS = 1_000;

interface SocketData {
  auth?: ChatTokenPayload;
  userKey?: string;
}

interface RateBucket {
  count: number;
  start: number;
}

/**
 * 聊天网关（/chat 命名空间）。
 *
 * 安全模型（P0 C1/C2/C3）：
 *  - 握手阶段校验 chat token（socket.handshake.auth.token），失败立即断开；
 *  - 所有事件的「发送者身份 / 用户身份」一律从已校验的 token 推导，绝不信任客户端报文；
 *  - 房间归属：client 只能加入 / 收发属于自己（room.clientEmail === token.email）的会话；
 *    agent 须为已校验的坐席令牌，且只能执行坐席动作。
 *
 * 可靠性（P1 H1）：配置 REDIS_URL 时启用 Socket.IO Redis Adapter + Redis presence，
 * 支持多实例 / 滚动发布；未配置则回退单实例内存模式。
 */
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
    pingInterval: 5_000,
    pingTimeout: 10_000,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // socket.id → 限流桶（P2 M2）
  private rate = new Map<string, RateBucket>();
  // 输入指示节流（P1 H2）：`${socketId}:${roomId}` → 上次转发时间戳
  private typingLast = new Map<string, number>();


  constructor(
    private readonly chatRoomService: ChatRoomService,
    private readonly chatAuth: ChatAuthService,
    private readonly presence: ChatPresenceStore,
    @Inject('CHAT_REDIS')
    private readonly redis: { pub: RedisClientType; sub: RedisClientType } | null,
  ) {}

  /** 配置 Redis Adapter（多实例消息广播）。 */
  afterInit(server: Server) {
    // 命名空间网关下，NestJS 传入的 `server` 实为 `Namespace`（其 `.adapter` 是
    // 实例属性、不可调用），需取 root `Server`（Namespace.server）来设置 Adapter，
    // 它会遍历所有命名空间重新初始化 adapter，使 /chat 命名空间生效。
    const ioServer = (server as unknown as { server?: Server }).server ?? server;
    if (this.redis?.pub && this.redis?.sub) {
      try {
        ioServer.adapter(createAdapter(this.redis.pub, this.redis.sub));
        this.logger.log('Socket.IO Redis Adapter 已启用（多实例模式）');
      } catch (error) {
        this.logger.error(`Redis Adapter 启用失败，回退单实例：${(error as Error).message}`);
      }
    }
  }

  // ── 鉴权与身份 ───────────────────────────────────────

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth && (client.handshake.auth.token as string | undefined)) || undefined;
    if (!token) {
      client.emit('auth-error', { message: '缺少聊天令牌' });
      client.disconnect(true);
      return;
    }

    let payload: ChatTokenPayload;
    try {
      payload = this.chatAuth.verify(token);
    } catch (error) {
      client.emit('auth-error', { message: (error as Error).message });
      client.disconnect(true);
      return;
    }

    const data = client.data as SocketData;
    data.auth = payload;
    data.userKey = `${payload.email}:${payload.type}`;
    this.logger.log(`Client connected: ${client.id} (${payload.type}:${payload.email})`);

    await this.handleConnectPresence(client, data.userKey, payload);

    // 连接即下发坐席可用性快照 + 聚合在线状态（避免冷启动被误判在线）
    const avail = await this.agentAvailability();
    client.emit('agents-online', avail);
    client.emit('presence-changed', {
      userEmail: 'agent@tzj.com',
      userType: 'agent',
      status: await this.agentAggregateStatus(),
      onlineCount: avail.online,
      awayCount: avail.away,
      lastOnlineAt: avail.lastOnlineAt,
    });

    if (payload.type === 'agent') {
      client.emit('my-presence', { status: await this.presence.getPresence(data.userKey) });
      await this.sendRoomListToAgent(client, payload.email);
      // 坐席需加入所有活跃房间才能接收实时 new-message 事件；
      // socket 断开重连后房间成员资格丢失，必须每次连接都重新加入。
      await this.joinAgentToActiveRooms(client);
      // 推送在线坐席花名册（含 email + 状态），供转接选择
      await this.broadcastAgentRoster();
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const data = client.data as SocketData;
    const userKey = data.userKey;
    if (!userKey) return;

    // 离开其所处房间（socket.io 会自动移除，这里补充显式广播）
    const rooms = Array.from(client.rooms);
    rooms.forEach((room) => {
      if (room !== client.id) {
        client.leave(room);
        this.server.to(room).emit('user-left', {
          socketId: client.id,
          roomId: room,
          userEmail: data.auth?.email,
          userType: data.auth?.type,
        });
      }
    });

    const count = await this.presence.removeSocket(userKey, client.id);
    if (count <= 0) {
      await this.presence.setStatus(userKey, 'offline');
      await this.broadcastPresenceFor(userKey);
    }
  }

  /** 取已校验身份；缺失则断开并返回 null。 */
  private getAuth(client: Socket): ChatTokenPayload | null {
    const auth = (client.data as SocketData).auth;
    if (!auth) {
      client.disconnect(true);
      return null;
    }
    return auth;
  }

  /** 校验房间存在 + 归属：client 仅能访问自己的会话；agent 可访问任意会话。 */
  private async roomOrError(
    client: Socket,
    roomId: string,
    auth: ChatTokenPayload,
  ): Promise<ChatRoomResult | null> {
    let room: ChatRoomResult;
    try {
      room = await this.chatRoomService.getChatRoomById(roomId);
    } catch {
      client.emit('error', { message: '会话不存在' });
      return null;
    }
    if (auth.type === 'client' && room.clientEmail !== auth.email) {
      client.emit('error', { message: '无权访问该会话' });
      return null;
    }
    return room;
  }

  // ── Presence（Redis / 内存） ─────────────────────────

  /** 连接时登记 socket 并恢复/初始化在线状态（多实例安全：状态持久于 store）。 */
  private async handleConnectPresence(
    client: Socket,
    userKey: string,
    auth: ChatTokenPayload,
  ): Promise<void> {
    const prevCount = await this.presence.getSocketCount(userKey);
    // 在 addSocket 更新 lastSeen 之前先读取，用于判断是否为“刚断开就重连”（如刷新页面）
    const prevMeta = prevCount === 0 ? await this.presence.getMeta(userKey) : null;
    await this.presence.addSocket(userKey, auth.email, auth.type, client.id);
    if (prevCount === 0) {
      const meta = await this.presence.getMeta(userKey);
      let restored: 'online' | 'away' | 'offline';
      if (meta?.status && meta.status !== 'offline') {
        // 存储中仍为 online/away（多 socket 场景或断线宽限未过期）
        restored = meta.status;
      } else if (
        auth.type === 'agent' &&
        prevMeta?.status &&
        prevMeta.status !== 'offline' &&
        prevMeta.lastSeen &&
        Date.now() - prevMeta.lastSeen < RECONNECT_GRACE_MS
      ) {
        // 坐席刚断开不久（如刷新页面）→ 视为短暂中断，恢复之前的在线状态
        this.logger.log(
          `Agent ${auth.email} reconnected within grace period, restoring ${prevMeta.status}`,
        );
        restored = prevMeta.status;
      } else {
        restored = auth.type === 'agent' ? 'offline' : 'online';
      }
      const changed = (meta?.status ?? 'offline') !== restored;
      await this.presence.setStatus(userKey, restored);
      if (changed) await this.broadcastPresenceFor(userKey);
    }
  }

  /** 广播某用户的在线状态变化（含聚合坐席态），多实例经 Redis Adapter 自动扩散。 */
  private async broadcastPresenceFor(userKey: string): Promise<void> {
    const meta = await this.presence.getMeta(userKey);
    if (!meta) return;
    const status = await this.presence.getPresence(userKey);

    this.server.emit('presence-changed', {
      userEmail: meta.email,
      userType: meta.userType,
      status,
    });

    if (meta.userType === 'agent') {
      const avail = await this.agentAvailability();
      this.server.emit('agents-online', avail);
      this.server.emit('presence-changed', {
        userEmail: 'agent@tzj.com',
        userType: 'agent',
        status: await this.agentAggregateStatus(),
        onlineCount: avail.online,
        awayCount: avail.away,
        lastOnlineAt: avail.lastOnlineAt,
      });
      // 坐席在线状态变化 → 同步在线花名册（供其他坐席转接选择）
      await this.broadcastAgentRoster();
    } else {
      // 访客状态变化 → 刷新坐席端会话列表（列表含 clientPresence）
      await this.broadcastRoomListUpdate();
    }
  }

  private async setStatusAndBroadcast(userKey: string, newStatus: PresenceStatus): Promise<void> {
    const meta = await this.presence.getMeta(userKey);
    if (!meta || meta.status === newStatus) return;
    await this.presence.setStatus(userKey, newStatus);
    // online/away 刷新「最后活跃」计时起点
    if (newStatus === 'online' || newStatus === 'away') {
      await this.presence.setLastSeen(userKey, Date.now());
    }
    this.logger.log(`Presence: ${meta.email} (${meta.userType}) → ${newStatus}`);
    await this.broadcastPresenceFor(userKey);
  }

  private async agentAvailability(): Promise<{
    online: number;
    away: number;
    lastOnlineAt: number | null;
  }> {
    const agents = await this.presence.getAgentSummaries();
    let online = 0;
    let away = 0;
    let lastOnlineAt: number | null = null;
    for (const a of agents) {
      if (lastOnlineAt === null || (a.lastSeen ?? 0) > lastOnlineAt)
        lastOnlineAt = a.lastSeen ?? null;
      if (a.status === 'online') online++;
      else if (a.status === 'away') away++;
    }
    return { online, away, lastOnlineAt };
  }

  private async agentAggregateStatus(): Promise<PresenceStatus> {
    const agents = await this.presence.getAgentSummaries();
    let anyOnline = false;
    let anyAway = false;
    for (const a of agents) {
      if (a.status === 'online') anyOnline = true;
      else if (a.status === 'away') anyAway = true;
    }
    return anyOnline ? 'online' : anyAway ? 'away' : 'offline';
  }

  /** 给 rooms 注入 clientPresence（按访客全局在线状态，跨实例一致）。 */
  private async enrichRoomsWithPresence(rooms: ChatRoomListItem[]): Promise<ChatRoomListItem[]> {
    return Promise.all(
      rooms.map(async (room) => {
        const status = await this.presence.getPresence(`${room.clientEmail}:client`);
        return { ...room, clientPresence: status };
      }),
    );
  }

  // ── 通知计数聚合（P2 M1） ─────────────────────────────

  private notifKey(userType: 'client' | 'agent', email: string): string {
    return userType === 'agent' ? 'agent' : `${email}:client`;
  }

  /** 始终从 DB 查询真实未读数，保证准确性（数据量小，查询开销可忽略）。 */
  private async getCountsFor(
    _key: string,
    userType: 'client' | 'agent',
    email: string,
  ): Promise<{
    totalUnread: number;
    roomCounts: Array<{ roomId: string; unreadCount: number; clientEmail: string; status: string }>;
  }> {
    return this.chatRoomService.getNotificationCounts(
      userType === 'agent' ? undefined : email,
      userType,
    );
  }

  // ── 定时扫描：心跳超时 → away / offline ────────────────

  @Interval(15_000)
  async scanPresence() {
    const now = Date.now();
    const all = await this.presence.getAllSummaries();
    for (const s of all) {
      if (s.socketCount <= 0) continue;
      const elapsed = now - (s.lastSeen || 0);
      if (elapsed > OFFLINE_MS) {
        if (s.status !== 'offline') await this.setStatusAndBroadcast(s.userKey, 'offline');
      } else if (elapsed > AWAY_MS) {
        if (s.status === 'online') await this.setStatusAndBroadcast(s.userKey, 'away');
      }
    }
  }

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

  // ── 事件处理 ─────────────────────────────────────────

  @SubscribeMessage('register-agent')
  async handleRegisterAgent(@ConnectedSocket() client: Socket) {
    const auth = this.getAuth(client);
    if (!auth || auth.type !== 'agent') {
      client.emit('error', { message: '仅坐席可注册' });
      return;
    }
    try {
      client.emit('agent-registered', { userEmail: auth.email });
      client.emit('my-presence', {
        status: await this.presence.getPresence(`${auth.email}:agent`),
      });
      await this.sendRoomListToAgent(client, auth.email);
    } catch (error) {
      this.logger.error('Error registering agent:', error);
      client.emit('error', { message: 'Failed to register agent' });
    }
  }

  async sendRoomListToAgent(socket: Socket, userEmail: string) {
    try {
      const result = await this.chatRoomService.getChatRooms({});
      const enriched = await this.enrichRoomsWithPresence(result.rooms);
      this.logger.log(`Sending room list to agent ${userEmail}: ${enriched.length} rooms`);
      socket.emit('room-list-updated', { rooms: enriched });
    } catch (error) {
      this.logger.error('Error sending room list to agent:', error);
    }
  }

  /** 坐席连接/重连时，自动加入所有活跃房间，确保接收实时 new-message 事件。
   *  Socket.IO 断开后房间成员资格丢失，必须每次连接都重新加入。 */
  private async joinAgentToActiveRooms(socket: Socket): Promise<void> {
    try {
      const result = await this.chatRoomService.getChatRooms({
        status: 'active,waiting',
        take: 100,
      });
      let joined = 0;
      for (const room of result.rooms) {
        socket.join(room.roomId);
        joined++;
      }
      this.logger.log(`Agent socket ${socket.id} joined ${joined} active rooms`);
    } catch (error) {
      this.logger.error('Error joining agent to active rooms:', error);
    }
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string }) {
    const auth = this.getAuth(client);
    if (!auth) return;
    const { roomId } = data;
    if (!roomId) return;

    const room = await this.roomOrError(client, roomId, auth);
    if (!room) return;

    await client.join(roomId);
    client.to(roomId).emit('user-joined', { userEmail: auth.email, userType: auth.type });
    client.emit('joined-room', { roomId, userEmail: auth.email, userType: auth.type });

    const myStatus = await this.presence.getPresence(`${auth.email}:${auth.type}`);
    client.to(roomId).emit('presence-changed', {
      userEmail: auth.email,
      userType: auth.type,
      status: myStatus,
      roomId,
    });

    if (auth.type === 'agent') {
      // waiting → active 并认领；active/closed/archived 仅同步负责人，不静默复活已关闭会话
      if (room.status === ChatRoomStatus.WAITING) {
        await this.chatRoomService.updateChatRoom(roomId, {
          status: ChatRoomStatus.ACTIVE,
          assignedAgentEmail: auth.email,
        });
        this.server.to(roomId).emit('room-status-changed', {
          roomId,
          status: 'active',
          assignedAgentEmail: auth.email,
        });
      } else if (room.status) {
        await this.chatRoomService.updateChatRoom(roomId, {
          assignedAgentEmail: auth.email,
        });
      }
    }
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const auth = this.getAuth(client);
    if (!auth) return;
    const { roomId } = data;
    if (!roomId) return;
    try {
      this.logger.log(`User ${auth.email} leaving room ${roomId}`);
      await client.leave(roomId);
      client.to(roomId).emit('user-left', {
        roomId,
        userEmail: auth.email,
        userType: auth.type,
      });
      client.emit('left-room', { roomId });
    } catch (error) {
      this.logger.error('Error leaving room:', error);
      client.emit('error', { message: 'Failed to leave room' });
    }
  }

  @SubscribeMessage('send-message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; content?: string; attachments?: string[] },
  ) {
    const auth = this.getAuth(client);
    if (!auth) return;
    const { roomId, content, attachments } = data;
    if (!roomId) return;

    // 限流（P2 M2）
    if (this.rateLimited(client.id)) {
      client.emit('error', { message: '发送过于频繁，请稍后再试' });
      return;
    }
    if (content && content.length > MAX_MESSAGE_LENGTH) {
      client.emit('error', { message: `消息过长，单条上限 ${MAX_MESSAGE_LENGTH} 字` });
      return;
    }

    const room = await this.roomOrError(client, roomId, auth);
    if (!room) return;

    const userKey = `${auth.email}:${auth.type}`;
    await this.presence.setLastSeen(userKey, Date.now());
    if ((await this.presence.getPresence(userKey)) !== 'online') {
      await this.setStatusAndBroadcast(userKey, 'online');
    }

    try {
      const updatedRoom = await this.chatRoomService.sendMessage(roomId, {
        content,
        sender: auth.type,
        senderEmail: auth.email,
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

      if (updatedRoom.reopened) {
        this.server.to(roomId).emit('room-status-changed', {
          roomId,
          status: updatedRoom.status,
          assignedAgentEmail: updatedRoom.assignedAgentEmail,
          reopened: true,
        });
      }

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
    @MessageBody() data: { roomId: string; messageIds?: string[] },
  ) {
    const auth = this.getAuth(client);
    if (!auth) return;
    const { roomId, messageIds } = data;
    if (!roomId) return;

    const room = await this.roomOrError(client, roomId, auth);
    if (!room) return;

    try {
      const updatedRoom = await this.chatRoomService.markMessagesAsReadByUser(
        roomId,
        auth.email,
        auth.type,
        messageIds,
      );

      this.logger.log(
        `[mark-read] ${auth.type}:${auth.email} room=${roomId.slice(0, 8)} ` +
          `marked=${updatedRoom.markedMessageIds.length} ids=[${updatedRoom.markedMessageIds.slice(0, 3).join(',')}]`,
      );

      this.server.to(roomId).emit('messages-read', {
        roomId,
        userEmail: auth.email,
        userType: auth.type,
        messageIds: updatedRoom.markedMessageIds,
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
  async handleGetNotificationCounts(@ConnectedSocket() client: Socket) {
    const auth = this.getAuth(client);
    if (!auth) return;
    try {
      const counts = await this.getCountsFor(
        this.notifKey(auth.type, auth.email),
        auth.type,
        auth.email,
      );
      client.emit('notification-counts', {
        userEmail: auth.email,
        userType: auth.type,
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
    @MessageBody() data: { roomId: string },
  ) {
    const auth = this.getAuth(client);
    if (!auth) return;
    const { roomId } = data;
    if (!roomId) return;
    try {
      await this.chatRoomService.resetNotificationCount(roomId, auth.type);
      client.emit('notification-count-reset', { roomId, userType: auth.type });
      await this.broadcastNotificationCounts();
    } catch (error) {
      this.logger.error('Error resetting notification count:', error);
      client.emit('error', { message: 'Failed to reset notification count' });
    }
  }

  @SubscribeMessage('update-room-status')
  async handleUpdateRoomStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; status: string; assignedAgentEmail?: string },
  ) {
    const auth = this.getAuth(client);
    if (!auth || auth.type !== 'agent') {
      client.emit('error', { message: '仅坐席可更新会话状态' });
      return;
    }
    const { roomId, status, assignedAgentEmail } = data;
    if (!roomId || !status) return;

    try {
      if (status === 'closed') {
        const updated = await this.chatRoomService.closeChatRoom(roomId, auth.email, '会话已关闭');
        const systemMessage = updated.messages[updated.messages.length - 1];
        const roomPayload = {
          roomId: updated.roomId,
          status: 'closed',
          assignedAgentEmail: updated.assignedAgentEmail,
          lastActivity: updated.lastActivity,
          unreadCountForClient: updated.unreadCountForClient,
          unreadCountForAgent: updated.unreadCountForAgent,
          closedAt: updated.closedAt,
        };
        if (systemMessage) {
          this.server.to(roomId).emit('new-message', { message: systemMessage, room: roomPayload });
        }
        this.server.to(roomId).emit('room-status-changed', roomPayload);
        await this.broadcastRoomListUpdate();
        return;
      }

      const chatRoomStatus =
        status === 'active'
          ? ChatRoomStatus.ACTIVE
          : status === 'waiting'
            ? ChatRoomStatus.WAITING
            : ChatRoomStatus.WAITING;

      const updateData: { status: string; assignedAgentEmail?: string } = {
        status: chatRoomStatus,
      };
      if (assignedAgentEmail) updateData.assignedAgentEmail = assignedAgentEmail;

      await this.chatRoomService.updateChatRoom(roomId, updateData);

      this.server.to(roomId).emit('room-status-changed', {
        roomId,
        status,
        assignedAgentEmail,
      });

      await this.broadcastRoomListUpdate();
    } catch (error) {
      this.logger.error('Error updating room status:', error);
      client.emit('error', { message: 'Failed to update room status' });
    }
  }

  /** 转接（P1 H3）：坐席把会话重新分配给另一名坐席。 */
  @SubscribeMessage('transfer-room')
  async handleTransferRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; toAgentEmail: string },
  ) {
    const auth = this.getAuth(client);
    if (!auth || auth.type !== 'agent') {
      client.emit('error', { message: '仅坐席可转接' });
      return;
    }
    const { roomId, toAgentEmail } = data;
    if (!roomId || !toAgentEmail) return;

    const room = await this.roomOrError(client, roomId, auth);
    if (!room) return;

    try {
      await this.chatRoomService.updateChatRoom(roomId, { assignedAgentEmail: toAgentEmail });
      this.server.to(roomId).emit('room-status-changed', {
        roomId,
        status: room.status,
        assignedAgentEmail: toAgentEmail,
        transferred: true,
        transferredBy: auth.email,
      });
      await this.broadcastRoomListUpdate();
    } catch (error) {
      this.logger.error('Error transferring room:', error);
      client.emit('error', { message: 'Failed to transfer room' });
    }
  }

  @SubscribeMessage('get-room-info')
  async handleGetRoomInfo(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const auth = this.getAuth(client);
    if (!auth) return;
    const { roomId } = data;
    if (!roomId) return;
    const room = await this.roomOrError(client, roomId, auth);
    if (!room) return;
    client.emit('room-info', room);
  }

  // ── 输入指示器（P1 H2） ───────────────────────────────

  @SubscribeMessage('typing')
  async handleTyping(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string }) {
    const auth = this.getAuth(client);
    if (!auth) return;
    const { roomId } = data;
    if (!roomId || !client.rooms.has(roomId)) return;
    const room = await this.roomOrError(client, roomId, auth);
    if (!room) return;

    const tk = `${client.id}:${roomId}`;
    const now = Date.now();
    const last = this.typingLast.get(tk) ?? 0;
    if (now - last < TYPING_THROTTLE_MS) return;
    this.typingLast.set(tk, now);

    client.to(roomId).emit('typing', {
      roomId,
      userEmail: auth.email,
      userType: auth.type,
    });
  }

  @SubscribeMessage('stop-typing')
  async handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const auth = this.getAuth(client);
    if (!auth) return;
    const { roomId } = data;
    if (!roomId || !client.rooms.has(roomId)) return;
    const room = await this.roomOrError(client, roomId, auth);
    if (!room) return;
    client.to(roomId).emit('stop-typing', {
      roomId,
      userEmail: auth.email,
      userType: auth.type,
    });
  }

  // ── Presence 专用事件 ─────────────────────────────────

  @SubscribeMessage('heartbeat')
  handleHeartbeat(@ConnectedSocket() client: Socket) {
    const auth = this.getAuth(client);
    if (!auth) return;
    const userKey = `${auth.email}:${auth.type}`;
    void this.presence.refreshSocket(userKey, client.id);
    // 心跳只续命 online 状态
    void (async () => {
      if ((await this.presence.getPresence(userKey)) === 'online') {
        await this.presence.setLastSeen(userKey, Date.now());
      }
    })();
  }

  @SubscribeMessage('user-idle')
  handleUserIdle(@ConnectedSocket() client: Socket) {
    const auth = this.getAuth(client);
    if (!auth) return;
    void this.setStatusAndBroadcast(`${auth.email}:${auth.type}`, 'away');
  }

  @SubscribeMessage('user-active')
  handleUserActive(@ConnectedSocket() client: Socket) {
    const auth = this.getAuth(client);
    if (!auth) return;
    void this.setStatusAndBroadcast(`${auth.email}:${auth.type}`, 'online');
  }

  @SubscribeMessage('client-gone')
  handleClientGone(@ConnectedSocket() client: Socket) {
    const auth = this.getAuth(client);
    if (!auth) return;
    const userKey = `${auth.email}:${auth.type}`;
    void (async () => {
      const count = await this.presence.removeSocket(userKey, client.id);
      if (count <= 0) {
        await this.presence.setStatus(userKey, 'offline');
        await this.broadcastPresenceFor(userKey);
      }
    })();
  }

  @SubscribeMessage('get-presence')
  handleGetPresence(@ConnectedSocket() client: Socket) {
    const auth = this.getAuth(client);
    if (!auth) return;
    void (async () => {
      const status = await this.presence.getPresence(`${auth.email}:${auth.type}`);
      client.emit('presence-changed', {
        userEmail: auth.email,
        userType: auth.type,
        status,
      });
    })();
  }

  @SubscribeMessage('set-presence')
  handleSetPresence(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { status: PresenceStatus },
  ) {
    const auth = this.getAuth(client);
    if (!auth) return;
    if (data?.status !== 'online' && data?.status !== 'away' && data?.status !== 'offline') {
      return;
    }
    void this.setStatusAndBroadcast(`${auth.email}:${auth.type}`, data.status);
  }

  // ── 广播 ──────────────────────────────────────────────

  async broadcastRoomListUpdate() {
    try {
      const result = await this.chatRoomService.getChatRooms({});
      const enriched = await this.enrichRoomsWithPresence(result.rooms);
      const sockets = this.server?.sockets?.sockets;
      if (!sockets) return;
      for (const sock of sockets.values()) {
        if (sock.data && (sock.data as SocketData).auth?.type === 'agent') {
          sock.emit('room-list-updated', { rooms: enriched });
        }
      }
    } catch (error) {
      this.logger.error('Error broadcasting room list update:', error);
    }
  }

  /** 广播在线坐席花名册（仅给坐席端，供转接时选择目标；含 email + 状态，避免泄露给访客）。 */
  private async broadcastAgentRoster(): Promise<void> {
    try {
      const agents = await this.presence.getAgentSummaries();
      const payload = {
        agents: agents.map((a) => ({ email: a.email, status: a.status })),
      };
      const sockets = this.server?.sockets?.sockets;
      if (!sockets) return;
      for (const sock of sockets.values()) {
        if ((sock.data as SocketData).auth?.type === 'agent') {
          sock.emit('agent-roster', payload);
        }
      }
    } catch (error) {
      this.logger.error('Error broadcasting agent roster:', error);
    }
  }

  async broadcastNotificationCounts() {
    try {
      const byUser = new Map<
        string,
        { email: string; type: 'client' | 'agent'; sockets: Socket[] }
      >();
      const sockets = this.server?.sockets?.sockets;
      if (!sockets) return;
      for (const sock of sockets.values()) {
        const auth = (sock.data as SocketData).auth;
        if (!auth) continue;
        const key = this.notifKey(auth.type, auth.email);
        let bucket = byUser.get(key);
        if (!bucket) {
          bucket = { email: auth.email, type: auth.type, sockets: [] };
          byUser.set(key, bucket);
        }
        bucket.sockets.push(sock);
      }

      for (const [key, info] of byUser) {
        const counts = await this.getCountsFor(key, info.type, info.email);
        const nonZero = counts.roomCounts.filter((r) => r.unreadCount > 0);
        this.logger.log(
          `[notif-counts] ${info.type}:${info.email} total=${counts.totalUnread} ` +
            `rooms=${counts.roomCounts.length} nonZero=${nonZero.length} ` +
            `[${nonZero.map((r) => `${r.roomId.slice(0, 8)}:${r.unreadCount}`).join(',')}]`,
        );
        for (const s of info.sockets) {
          s.emit('notification-counts-updated', {
            userEmail: info.email,
            userType: info.type,
            ...counts,
          });
        }
      }
    } catch (error) {
      this.logger.error('Error broadcasting notification counts:', error);
    }
  }

  // ── 限流（P2 M2） ─────────────────────────────────────

  private rateLimited(socketId: string): boolean {
    const now = Date.now();
    let bucket = this.rate.get(socketId);
    if (!bucket || now - bucket.start > RATE_WINDOW_MS) {
      bucket = { count: 0, start: now };
      this.rate.set(socketId, bucket);
    }
    bucket.count += 1;
    return bucket.count > RATE_LIMIT_PER_MINUTE;
  }
}
