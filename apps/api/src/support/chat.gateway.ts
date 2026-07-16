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
/**
 * 断线宽限期（socket 真正 FIN/断开后延迟广播 offline）。
 * 仅作「网络微抖 / 重连瞬间」这类脏断兜底，故取较短值；
 * 刷新场景已由 client-gone 显式离开信号 + 重连取消定时器覆盖，无需长宽限。
 * 坐席与访客统一 10s：原 30s 会把「真走了」也拖慢，不符合即时可用性反馈。
 */
const DISCONNECT_GRACE_MS = 10_000;
const DISCONNECT_GRACE_MS_CLIENT = 10_000;
/**
 * 显式离开（client-gone，页面 pagehide/beforeunload 主动上报）的宽限。
 * 比断线宽限更短：刷新时新连接会在该窗口内重连并取消定时器（坐席不丢在线）；
 * 真关闭则在该窗口后尽快置 offline，使 C 端秒级反映「暂无坐席在线」。
 * 坐席用更短值，因其重连不会自动拉回 online，需尽快让访客看到真实状态。
 */
const CLIENT_GONE_GRACE_MS = 5_000;

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
    // 缩短心跳探测：标签页关闭但 disconnect 包未及时送达时，
    // 服务端也能更快（约 pingInterval+pingTimeout ≈ 15s）检测到死连接，
    // 避免客户关闭标签页后长期显示「在线」。
    pingInterval: 5_000,
    pingTimeout: 10_000,
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

    // 新 socket 接入不自动变更状态：坐席状态由显式 set-presence 驱动。
    // 客户端仅在确为更低状态（offline）时才升级为 online，避免把已「离开」
    // （away，如前端点了关闭聊天面板）的客户因重连 / 重进房间被粗暴拉回 online，
    // 使 B 端看到的在线状态更诚实。
    if (userType === 'client') {
      if (entry.status === 'offline') {
        this.updatePresence(key, 'online');
      }
    }
  }

  /** 安排离线宽限：仅当尚无待执行定时器时才设置（避免被更长的断线宽限覆盖）。
   *  刷新 / 重连会在窗口内经 registerSocket 取消该定时器，故不会误判离线。 */
  private scheduleOffline(key: string, graceMs: number) {
    if (this.offlineTimers.has(key)) return;
    this.offlineTimers.set(
      key,
      setTimeout(() => {
        this.offlineTimers.delete(key);
        // 再次确认无 socket 残留（可能在宽限期内又断开 / 重连）
        const latest = this.presence.get(key);
        if (latest && latest.sockets.size === 0) {
          this.updatePresence(key, 'offline');
        }
      }, graceMs),
    );
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
      // 宽限期：延时再广播 offline。坐席/访客统一短宽限，仅吸收网络微抖；
      // 刷新由 client-gone + 重连取消定时器覆盖，不会 online→offline→online 抖动。
      const graceMs = entry.userType === 'agent' ? DISCONNECT_GRACE_MS : DISCONNECT_GRACE_MS_CLIENT;
      this.scheduleOffline(key, graceMs);
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
    // online/away 均重置「最后活跃」计时起点：online 之后由 heartbeat 续命，
    // away 不续命 → 超 OFFLINE_MS 后自然降级 offline（修复「离开页面却一直 away」卡死）。
    if (newStatus === 'online' || newStatus === 'away') {
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

  /** 判断某访客当前是否有 socket 实际处于该房间（用于按房间计算在线状态） */
  private isUserInRoom(roomId: string, userEmail: string): boolean {
    const key = this.presenceKey(userEmail, 'client');
    const entry = this.presence.get(key);
    if (!entry || entry.sockets.size === 0) return false;
    for (const socketId of entry.sockets) {
      const info = this.connectedUsers.get(socketId);
      if (info && info.socket.rooms.has(roomId)) return true;
    }
    return false;
  }

  /** 给 rooms 数组注入 clientPresence 字段（按「访客是否实际在该房间」计算，
   *  而非全局按 userEmail——访客离开旧会话（点「开始新会话」leave-room）后，
   *  旧房间即离线，新房间仍在线，互不影响） */
  private enrichRoomsWithPresence(rooms: any[]): any[] {
    return rooms.map((room) => {
      const key = this.presenceKey(room.clientEmail, 'client');
      const entry = this.presence.get(key);
      const inRoom = entry ? this.isUserInRoom(room.roomId, room.clientEmail) : false;
      return {
        ...room,
        clientPresence: inRoom && entry ? entry.status : 'offline',
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
          roomId: room,
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
        // 断开后的 offline 交由 unregisterSocket 的宽限定时器负责，
        // 避免刷新页面等短暂停顿被立即判离线（刷新后坐席丢失在线状态的根因）。
        // 仅作兜底：无任何 pending 定时器且长期无活动时才强制 offline。
        const timer = this.offlineTimers.get(key);
        if (!timer && entry.status !== 'offline' && now - entry.lastSeen > OFFLINE_MS) {
          this.updatePresence(key, 'offline');
        }
        continue;
      }
      const elapsed = now - entry.lastSeen;
      if (elapsed > OFFLINE_MS) {
        // 超时：online / away 均落 offline（修复 away 卡死、无法超时转 offline 的问题）
        if (entry.status !== 'offline') {
          this.updatePresence(key, 'offline');
        }
      } else if (elapsed > AWAY_MS) {
        // 仅 online → away；away 状态保持，等待上面的超时分支落 offline
        if (entry.status === 'online') {
          this.updatePresence(key, 'away');
        }
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
      // 下发坐席当前 presence，供前端刷新后恢复在线状态
      // （后端内存中的 presence 不因前端刷新丢失，宽限期内重连状态保持）
      client.emit('my-presence', { status: this.getPresence(userEmail, 'agent') });
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

      // 访客加入房间时，仅向本房间广播其当前 presence（携带 roomId），
      // 使 B 端「打开的会话」视图即时切到在线；但不再全局广播——否则访客
      // 「开始新会话」加入新房间时，会把已 leave 的旧房间也一并点亮为在线。
      // 各房间的在线状态统一由 enrichRoomsWithPresence 按「访客是否实际在房间」
      // 计算（离开旧房间即离线），列表刷新即正确呈现。
      if (userType === 'client') {
        client.to(roomId).emit('presence-changed', {
          userEmail,
          userType,
          status: myPresence,
          roomId,
        });
      }

      if (userType === 'agent') {
        // 仅对「待处理(waiting)」会话做 领取→active 的状态迁移；
        // 已关闭/已归档的会话被坐席选中、或刷新后自动重选时，保持原状态不变，
        // 避免 join-room 把 closed 静默复活为 active —— 即「关闭后刷新又变回可聊」
        // 这类与「关闭即终态」相悖的割裂行为。要继续此类会话须走显式「重新打开」。
        let currentStatus: string | undefined;
        try {
          currentStatus = (await this.chatRoomService.getChatRoomById(roomId)).status;
        } catch {
          currentStatus = undefined;
        }

        if (currentStatus === ChatRoomStatus.WAITING) {
          await this.chatRoomService.updateChatRoom(roomId, {
            status: ChatRoomStatus.ACTIVE,
            assignedAgentEmail: userEmail,
          });
          this.server.to(roomId).emit('room-status-changed', {
            roomId,
            status: 'active',
            assignedAgentEmail: userEmail,
          });
        } else if (currentStatus) {
          // active/closed/archived：仅同步负责人（closed/archived 状态保持不变），
          // 不再下发 room-status-changed，避免前端把已关闭会话误判回进行中。
          await this.chatRoomService.updateChatRoom(roomId, {
            assignedAgentEmail: userEmail,
          });
        }
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
          roomId,
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

      // 访客「回复即重开」：同一会话从 closed 回到 active/waiting，
      // 广播状态变更，使访客与坐席两端 UI 即时切回进行中（输入框恢复可用）。
      // reopened 标记让坐席端能区分「访客重新打开」与坐席侧的其它状态变更，
      // 从而给出明确提示并把会话重新带入坐席视野。
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

      // 「结束会话」：复用 closeChatRoom 写入「会话已关闭」系统消息（DB 幂等，避免重复），
      // 并实时广播该系统消息，使坐席/访客两端无需刷新即可在对话流内看到「会话已关闭」标签。
      if (status === 'closed') {
        const updated = await this.chatRoomService.closeChatRoom(
          roomId,
          userInfo.userEmail,
          '会话已关闭',
        );
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
          this.server.to(roomId).emit('new-message', {
            message: systemMessage,
            room: roomPayload,
          });
        }
        this.server.to(roomId).emit('room-status-changed', roomPayload);
        await this.broadcastRoomListUpdate();
        return;
      }

      let chatRoomStatus: string;
      switch (status) {
        case 'active':
          chatRoomStatus = ChatRoomStatus.ACTIVE;
          break;
        case 'waiting':
          chatRoomStatus = ChatRoomStatus.WAITING;
          break;
        default:
          chatRoomStatus = ChatRoomStatus.WAITING;
      }

      const updateData: any = { status: chatRoomStatus };
      if (assignedAgentEmail) {
        updateData.assignedAgentEmail = assignedAgentEmail;
      }

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

    // 心跳只续命 online 状态；away/offline 不刷新 lastSeen，使其能按
    // OFFLINE_MS 超时自然降级为 offline（修复 away 卡死、无法超时转 offline）。
    // 状态切换仍统一由 set-presence 显式驱动。
    if (entry.status === 'online') {
      entry.lastSeen = Date.now();
    }
  }

  /** 客户端主动报告 idle（标签页切到后台 / 关闭聊天面板 / 无操作） */
  @SubscribeMessage('user-idle')
  handleUserIdle(@ConnectedSocket() client: Socket) {
    const userInfo = this.connectedUsers.get(client.id);
    if (!userInfo) return;
    const key = this.presenceKey(userInfo.userEmail, userInfo.userType);
    this.updatePresence(key, 'away');
  }

  /** 客户端主动报告 active（打开聊天面板 / 切回前台）：恢复 online。
   *  与 user-idle 成对，使 B 端看到的「客户是否还在看聊天」状态诚实，
   *  而非简单地等于「网站标签页是否还开着」。可绕过 registerSocket 的
   *  条件升级限制，显式把 away/offline 拉回 online。 */
  @SubscribeMessage('user-active')
  handleUserActive(@ConnectedSocket() client: Socket) {
    const userInfo = this.connectedUsers.get(client.id);
    if (!userInfo) return;
    const key = this.presenceKey(userInfo.userEmail, userInfo.userType);
    this.updatePresence(key, 'online');
  }

  /** 页面销毁（关闭标签页 / 离开站点）时主动上报「我离开了」。
   *  与 disconnect 的宽限不同：这是客户端的明确信号，只要该用户没有其它
   *  仍在连接的 socket（多标签页场景），即按「显式离开」快路径处理：
   *   - 访客：重连会自动 offline→online，可立即置 offline，使 B 端尽快反映；
   *   - 坐席：重连不会自动拉回 online，故用更短的 CLIENT_GONE_GRACE_MS 宽限——
   *     刷新可在窗口内重连取消（不丢在线），真关闭则尽快 offline，避免 C 端
   *     长时间看到「在线」假象。 */
  @SubscribeMessage('client-gone')
  handleClientGone(@ConnectedSocket() client: Socket) {
    const userInfo = this.connectedUsers.get(client.id);
    if (!userInfo) return;
    const key = this.presenceKey(userInfo.userEmail, userInfo.userType);
    const entry = this.presence.get(key);
    if (!entry) return;
    // 当前 socket 仍在集合内；size<=1 表示它是最后一个连接
    if (entry.sockets.size <= 1) {
      if (userInfo.userType === 'client') {
        this.updatePresence(key, 'offline');
        return;
      }
      this.scheduleOffline(key, CLIENT_GONE_GRACE_MS);
    }
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
