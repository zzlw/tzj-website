import { BadRequestException, Inject, Logger } from '@nestjs/common';
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
import type { Server, Socket, RemoteSocket } from 'socket.io';
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
/**
 * 断线宽限期：socket 数归零后，延迟这么多毫秒才判定「真正离线」。
 * 期间乐观保持「在线」（不降级为 away），吸收切桌面 / 合盖 / 网络抖动 / 换设备等瞬时缺口，
 * 避免 C 端访客把短暂断线误读为「离开中 · 留言后我们会尽快回复」；
 * 若同一 userKey 在窗口内重连（含不同设备实例）则取消定时器并恢复在线；
 * 超时仍无 socket 才真正判定离线。
 */
const OFFLINE_GRACE_MS = 60_000;

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
  // 断线宽限期内的待定离线定时器（A）：userKey → timer
  private pendingOfflineTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // 等待队列周期性扫描定时器（安全网：即时分配失败时 10s 内自动补分配）
  private waitingQueueSweep: ReturnType<typeof setInterval> | null = null;


  constructor(
    private readonly chatRoomService: ChatRoomService,
    private readonly chatAuth: ChatAuthService,
    private readonly presence: ChatPresenceStore,
    @Inject('CHAT_REDIS')
    private readonly redis: { pub: RedisClientType; sub: RedisClientType } | null,
  ) {}

  /** 配置 Redis Adapter（多实例消息广播）+ 启动等待队列周期性扫描。 */
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
    // 业内最佳实践（LiveChat/Intercom）：即时分配 + 周期性兜底扫描。
    // 若建房时因瞬态原因（presence 刷新延迟、坐席刚好切标签等）分配失败，
    // 10s 内自动补分配，确保访客不会长时间卡在「未分配」。
    this.waitingQueueSweep = setInterval(() => void this.drainWaitingQueue(), 10_000);
  }

  // ── 鉴权与身份 ───────────────────────────────────────

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth && (client.handshake.auth.token as string | undefined)) || undefined;

    // 匿名连接（无 token）：允许保持连接以接收坐席可用性广播（agents-online / presence-changed），
    // 使访客在创建房间之前就能看到客服在线状态。所有需要身份的操作由 getAuth() 守卫。
    if (!token) {
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
      // 坐席上线 → 检查等待队列是否有未分配会话，自动派单
      void this.drainWaitingQueue();
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
      // A：不要立即离线，进入断线宽限期（期间存储态乐观保持 online，超时才 offline）
      await this.schedulePendingOffline(userKey);
      // 坐席 socket 归零 → 立即广播真实可用性快照（online 计数按存活 socket 统计，
      // 此时已为 0），使 C 端访客即时感知「无坐席在线」，而非等 60s 宽限期到期。
      // 宽限期仅保留存储态语义（自动派单 / 花名册不抖动）；若宽限期内重连，
      // handleConnectPresence 会再次广播恢复在线。
      if (data.auth?.type === 'agent') {
        await this.broadcastAgentAvailabilityNow();
      }
      // 访客关闭标签页/浏览器（非点击面板关闭）时，pagehide 的 chat-panel:false 可能
      // 因组件卸载而发不出。socket 归零即视为「已不在查看对话」，立即清除 engagement
      // 信号并刷新坐席列表，避免 B 端残留「正在查看对话」徽标（此操作不影响在线宽限）。
      if (data.auth?.type === 'client') {
        await this.presence.setChatPanelOpen(userKey, false);
        await this.broadcastRoomListUpdate();
      }
    }
  }

  /**
   * A/C：socket 数归零后进入断线宽限期。
   * - 手动离线的用户保持 offline，不排程（重连也不会复活为在线）；
   * - 其余用户「存储态乐观保持在线」：宽限期内不降级，保证自动派单 / 花名册等
   *   B 端语义不因切桌面 / 合盖 / 网络抖动而抖动；
   * - C 端访客侧已与该存储态解耦：handleDisconnect 在宽限期开始的同时即广播
   *   真实可用性快照（按存活 socket 统计），访客即时看到「无坐席在线」；
   * - 宽限期内若同一 userKey 重连（含不同设备实例），handleConnectPresence 会取消本定时器、
   *   恢复在线并再次广播可用性快照；超时仍无 socket 才真正判定 offline。
   */
  private async schedulePendingOffline(userKey: string): Promise<void> {
    const existing = this.pendingOfflineTimers.get(userKey);
    if (existing) clearTimeout(existing);

    const meta = await this.presence.getMeta(userKey);
    if (meta?.manualOffline) {
      await this.presence.setStatus(userKey, 'offline');
      await this.broadcastPresenceFor(userKey);
      return;
    }

    // 断线宽限期内「乐观保持在线」：不立即降级为 away，避免 C 端访客看到
    // 「离开中」闪烁；超时仍无 socket 才在下方定时器里判定为 offline。
    this.pendingOfflineTimers.set(
      userKey,
      setTimeout(() => {
        void (async () => {
          this.pendingOfflineTimers.delete(userKey);
          const count = await this.presence.getSocketCount(userKey);
          if (count <= 0) {
            await this.presence.setStatus(userKey, 'offline');
            await this.broadcastPresenceFor(userKey);
          }
        })();
      }, OFFLINE_GRACE_MS),
    );
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

  /** 进程关闭时清理待定离线定时器和周期扫描，避免悬挂 timer。 */
  async beforeApplicationShutdown(): Promise<void> {
    if (this.waitingQueueSweep) clearInterval(this.waitingQueueSweep);
    for (const timer of this.pendingOfflineTimers.values()) clearTimeout(timer);
    this.pendingOfflineTimers.clear();
    // 清理限流和输入指示节流 Map，避免内存泄漏
    this.rate.clear();
    this.typingLast.clear();
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
    await this.presence.addSocket(userKey, auth.email, auth.type, client.id);

    // 取消待定离线定时器——任何（重连 / 刷新 / 换设备）新 socket 连上都应立即取消宽限，
    // 不依赖「是否还有其它实例在线」判断。旧实现用 prevCount===0 作门槛，会在刷新瞬间
    // 旧 socket 尚未从 store 移除（prevCount===1）时跳过取消，导致新连接继承了旧 socket
    // 的离线/away 状态，表现为「刷新后回到离线」。
    const timer = this.pendingOfflineTimers.get(userKey);
    if (timer) {
      clearTimeout(timer);
      this.pendingOfflineTimers.delete(userKey);
    }

    const meta = await this.presence.getMeta(userKey);
    // 手动离线的用户重连也不自动复活
    if (meta?.manualOffline) {
      await this.presence.setStatus(userKey, 'offline');
      await this.broadcastPresenceFor(userKey);
      return;
    }

    // 只要有 socket 连上（含刷新/重连场景），即视为在线——这与「访客已在线、坐席回到工作台」
    // 的语义一致。旧的 prevCount===0 门槛会在刷新时因旧 socket 未移除而跳过恢复在线，
    // 使服务端 my-presence 返回离线；而客户端 ChatPresenceProvider 只认 my-presence、忽略
    // presence-changed，于是刷新后一直显示离线。统一为「连上即在线」，保证 my-presence 正确。
    const restored: PresenceStatus = 'online';
    const changed = (meta?.status ?? 'offline') !== restored;
    await this.presence.setStatus(userKey, restored);
    if (changed) {
      await this.broadcastPresenceFor(userKey);
    } else if (auth.type === 'agent') {
      // 宽限期内重连：存储态未变（仍 online）但断线时已广播「无坐席在线」快照，
      // 必须再次广播恢复在线，否则 C 端会一直停留在「已离线」直到下次状态变更。
      await this.broadcastAgentAvailabilityNow();
    }
  }

  /**
   * 立即广播坐席可用性快照（agents-online + 聚合 presence-changed），不含个人事件。
   *
   * 用于断线宽限期「存储态不变但真实连接数已变」的场景：
   *  - 坐席 socket 归零 → 立即告知访客「无坐席在线」（不再等 60s 宽限到期）；
   *  - 宽限期内重连 → 立即恢复「在线」。
   * 宽限期设计（存储态乐观保持 online）仅服务于派单 / 花名册等 B 端语义，
   * 访客侧以存活 socket 数为准，保证「全部坐席离线 → 即时可见」。
   */
  private async broadcastAgentAvailabilityNow(): Promise<void> {
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
      // 访客聊天面板开关是独立 engagement 信号；坐席无此概念（恒 false），附带无害。
      chatPanelOpen: meta.chatPanelOpen ?? false,
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
      // 面向访客的在线聚合只统计「确实持有存活 socket」的坐席。
      // scanPresence 会跳过 socketCount<=0 的记录，真正离线仅靠内存宽限定时器（重启即丢失）
      // 或手动下线，故 status 可能残留为 online 的「僵尸坐席」。此处以存活连接为准，
      // 避免无人在线却对访客显示「在线客服」。
      if (a.socketCount <= 0) continue;
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
      // 同 agentAvailability：仅认可持有存活 socket 的坐席，排除「僵尸坐席」误报在线。
      if (a.socketCount <= 0) continue;
      if (a.status === 'online') anyOnline = true;
      else if (a.status === 'away') anyAway = true;
    }
    return anyOnline ? 'online' : anyAway ? 'away' : 'offline';
  }

  /**
   * 给 rooms 注入 clientPresence。
   *
   * 关键语义：在线态按「访客当前是否在该会话房间内」判定，而非全局在线。
   *  - 在房间内 → 取其全局在线状态（online/away/offline），例如访客正在该会话中输入/查看；
   *  - 已离开该会话（点「开始新对话」leave-room、或真正断开该房间）→ 该会话的访客即离线。
   * 这样 B 端：访客「开始新对话」后，旧会话会立刻（且刷新后一致地）显示为离线，
   * 新会话显示为在线，避免「旧会话仍在线、刷新后才离线」的不一致。
   * 房间成员关系是唯一真相源（join-room / leave-room / 断开 维护）。
   *
   * 仅一次 fetchSockets（按 roomId:email 建立「在房间内」集合），避免逐房间网络调用。
   */
  private async enrichRoomsWithPresence(rooms: ChatRoomListItem[]): Promise<ChatRoomListItem[]> {
    const sockets = await this.server.fetchSockets();
    const inRoomKeys = new Set<string>();
    for (const s of sockets) {
      const auth = (s.data as SocketData | undefined)?.auth;
      if (auth?.type === 'client' && auth?.email) {
        const roomSet = (s as unknown as { rooms?: Iterable<string> }).rooms ?? [];
        for (const roomId of roomSet) inRoomKeys.add(`${roomId}:${auth.email}`);
      }
    }
    return Promise.all(
      rooms.map(async (room) => {
        const inRoom = inRoomKeys.has(`${room.roomId}:${room.clientEmail}`);
        const status: PresenceStatus = inRoom
          ? await this.presence.getPresence(`${room.clientEmail}:client`)
          : 'offline';
        // 面板打开是独立 engagement 信号：仅在访客处于该会话房间内时取其值，
        // 离开房间后无意义（置 false）。与在线态（clientPresence）解耦，
        // 不再用面板开关翻转 online/away（业内最佳实践：在线态只看连接 + 标签页可见）。
        const meta = inRoom ? await this.presence.getMeta(`${room.clientEmail}:client`) : null;
        return {
          ...room,
          clientPresence: status,
          clientPanelOpen: meta?.chatPanelOpen ?? false,
        };
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

  /** 定期清理过期的限流和输入指示节流记录，避免 Map 无界增长 */
  @Interval(5 * 60_000)
  cleanupStaleEntries() {
    const now = Date.now();
    // 清理超过 2 分钟的限流记录（限流窗口为 1 分钟）
    for (const [key, bucket] of this.rate) {
      if (now - bucket.start > RATE_WINDOW_MS * 2) {
        this.rate.delete(key);
      }
    }
    // 清理超过 10 秒的输入指示记录（输入指示超时为 4 秒）
    for (const [key, ts] of this.typingLast) {
      if (now - ts > 10_000) {
        this.typingLast.delete(key);
      }
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

  /** 坐席主动请求会话列表（切换菜单返回聊天页时，socket 已连接但需重新拉取列表） */
  @SubscribeMessage('request-room-list')
  async handleRequestRoomList(@ConnectedSocket() client: Socket) {
    const auth = this.getAuth(client);
    if (!auth || auth.type !== 'agent') return;
    await this.sendRoomListToAgent(client, auth.email);
  }

  async sendRoomListToAgent(socket: Socket, userEmail: string) {
    try {
      const result = await this.chatRoomService.getChatRooms({});
      const enriched = await this.enrichRoomsWithPresence(result.rooms);
      // 附带状态统计，使 Tab 计数不再依赖独立 HTTP API（解决切换菜单后 HTTP 鉴权丢失导致计数为 0 的问题）
      const stats = await this.chatRoomService.getChatRoomStats();
      this.logger.log(`Sending room list to agent ${userEmail}: ${enriched.length} rooms`);
      socket.emit('room-list-updated', { rooms: enriched, statusBreakdown: stats.statusBreakdown });
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

  /**
   * 等待队列自动分配（业内最佳实践）：
   * 当坐席上线或关闭会话释放容量时，检查是否有未分配的 waiting 会话，
   * 若有则自动派给负载最低的在线坐席，缩短访客等待时间。
   */
  async drainWaitingQueue(): Promise<void> {
    try {
      // 防御性检查：测试环境中 chatRoomService 可能为 null 或缺少方法
      if (!this.chatRoomService?.getChatRooms || !this.chatRoomService?.assignAvailableAgent) return;
      const waiting = await this.chatRoomService.getChatRooms({
        status: 'waiting',
        take: 5,
      });
      if (waiting.rooms.length === 0) return;

      for (const room of waiting.rooms) {
        // 已分配的跳过（可能是坐席手动接入后状态尚未刷新）
        if (room.assignedAgentEmail) continue;
        const assigned = await this.chatRoomService.assignAvailableAgent(room.roomId);
        if (assigned) {
          this.server.to(room.roomId).emit('room-status-changed', {
            roomId: room.roomId,
            status: 'active',
            assignedAgentEmail: assigned,
          });
          this.logger.log(`等待队列自动分配: ${room.roomId} → ${assigned}`);
        } else {
          // 无可用坐席，停止尝试（剩余 waiting 会话继续等待）
          break;
        }
      }
      await this.broadcastRoomListUpdate();
    } catch (error) {
      this.logger.error('Error draining waiting queue:', error);
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
      // 业内最佳实践（Intercom/Zendesk/LiveChat）：查看 ≠ 分配。
      // 仅「认领无主会话」变更所有权；点别人的会话是只读浏览（主管 QA、
      // 同事查上下文），所有权转移必须走显式「转接」动作。
      if (room.status === ChatRoomStatus.WAITING) {
        // waiting（无主）→ 首响应坐席认领
        await this.chatRoomService.updateChatRoom(roomId, {
          status: ChatRoomStatus.ACTIVE,
          assignedAgentEmail: auth.email,
        });
        this.server.to(roomId).emit('room-status-changed', {
          roomId,
          status: 'active',
          assignedAgentEmail: auth.email,
        });
      } else if (room.status === ChatRoomStatus.ACTIVE && !room.assignedAgentEmail) {
        // active 但无负责人（边界：负责人被清除）→ 认领
        await this.chatRoomService.updateChatRoom(roomId, {
          assignedAgentEmail: auth.email,
        });
        this.server.to(roomId).emit('room-status-changed', {
          roomId,
          status: 'active',
          assignedAgentEmail: auth.email,
        });
      }
      // 已分配给他人 / closed / archived → 仅查看，不变更所有权。
      // 此前无条件覆写 assignedAgentEmail → 点一下别人的会话就被抢走，
      // 点已关闭会话还会复活幽灵负责人。
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

    // 归属校验（业内最佳实践 Intercom/Zendesk/LiveChat：一会话一负责人，仅负责人对客回复）。
    // 与 join-room「查看≠分配」「所有权转移须走显式转接」一致：坐席不得向「他人负责」的会话
    // 直接发对客消息，避免双人抢答、客户看到两人回复、责任不清。无主会话（waiting /
    // active 无负责人）不拦截，视为「回复即认领」；如需接手他人会话须先转接/认领。
    if (auth.type === 'agent' && room.assignedAgentEmail && room.assignedAgentEmail !== auth.email) {
      client.emit('error', {
        code: 'NOT_ASSIGNEE',
        roomId,
        message: '该会话由其他坐席负责，如需回复请先转接或认领',
      });
      return;
    }

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
      // 透传结构化错误码（如 ROOM_ARCHIVED）：归档是冷存终态，C 端据此「开启新会话」
      // 承接本条消息，而非静默丢弃 —— 杜绝访客消息石沉大海（业内最佳实践 Zendesk/Intercom）。
      const resp = error instanceof BadRequestException ? error.getResponse() : null;
      const code =
        resp && typeof resp === 'object' && 'code' in resp
          ? (resp as { code?: string }).code
          : undefined;
      client.emit('error', { code, roomId, message: 'Failed to send message' });
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

      // 已读回执的实时事件已在上方立即发出，下方的聚合计数和列表刷新不阻塞已读指示器，
      // 改为 fire-and-forget 避免延迟「已读」反馈。
      void this.broadcastNotificationCounts();
      void this.broadcastRoomListUpdate();
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

  /**
   * 关闭会话 + 完整通知链路（系统消息落库 → 广播 new-message + room-status-changed）。
   * 单会话关闭（socket）与批量关闭（HTTP controller）共用此方法，保证行为一致：
   * 访客端实时看到「会话已关闭」并进入关闭态，而非等发消息时才发现。
   * 幂等：已关闭的会话不会重复写入系统消息（closeChatRoom 内部保证）。
   */
  async closeRoomAndNotify(roomId: string, closedBy: string): Promise<void> {
    const updated = await this.chatRoomService.closeChatRoom(roomId, closedBy, '会话已关闭');
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
    // 仅当最后一条确实是本次写入的系统消息时才广播（幂等路径不重发旧消息）
    if (systemMessage?.sender === 'system') {
      this.server.to(roomId).emit('new-message', { message: systemMessage, room: roomPayload });
    }
    this.server.to(roomId).emit('room-status-changed', roomPayload);
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
        await this.closeRoomAndNotify(roomId, auth.email);
        await this.broadcastRoomListUpdate();
        // 关闭会话释放坐席容量 → 检查等待队列自动派单
        void this.drainWaitingQueue();
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

  /** 转接（P1 H3）：坐席把会话重新分配给另一名坐席（业内最佳实践增强版）。 */
  @SubscribeMessage('transfer-room')
  async handleTransferRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; toAgentEmail: string; note?: string },
  ) {
    const auth = this.getAuth(client);
    if (!auth || auth.type !== 'agent') {
      client.emit('error', { message: '仅坐席可转接' });
      return;
    }
    const { roomId, toAgentEmail, note } = data;
    if (!roomId || !toAgentEmail) return;

    const room = await this.roomOrError(client, roomId, auth);
    if (!room) return;

    // ① 拦截无操作转接：转给「当前已负责该会话的坐席」是 NO-OP，只会产生冗余系统消息、
    // 通知与困惑记录。业内最佳实践（Zendesk/Intercom）UI 从目标列表剔除当前负责人，
    // 服务端再兜底拒绝（防陈旧 UI / 竞态 / 直连 API）。
    if (room.assignedAgentEmail && room.assignedAgentEmail === toAgentEmail) {
      client.emit('error', { message: '该会话已由此坐席负责，无需转接' });
      return;
    }

    // ② 验证目标坐席在线（业内最佳实践：不允许转接给离线坐席）
    const targetKey = `${toAgentEmail}:agent`;
    const targetStatus = await this.presence.getPresence(targetKey);
    if (targetStatus === 'offline') {
      client.emit('error', { message: '目标坐席当前不在线，无法转接' });
      return;
    }

    try {
      // ③ 更新分配
      await this.chatRoomService.updateChatRoom(roomId, { assignedAgentEmail: toAgentEmail });

      // 查询目标坐席 + 原负责人显示名（用于访客通知 + 系统消息）
      const prevOwnerEmail = room.assignedAgentEmail ?? null;
      const isSelfTakeover = toAgentEmail === auth.email; // 转给自己 = 接管
      const rosterEmails = prevOwnerEmail ? [toAgentEmail, prevOwnerEmail] : [toAgentEmail];
      const details = await this.chatRoomService.getAgentRosterDetails(rosterEmails);
      const toAgentName = details.get(toAgentEmail)?.name || toAgentEmail;
      const prevOwnerName = prevOwnerEmail
        ? details.get(prevOwnerEmail)?.name || prevOwnerEmail
        : '';

      // ④ 先将目标坐席加入房间（修复竞态：确保后续广播能收到）
      // 业内最佳实践：转接时先建立连接再推送消息，避免目标坐席错过系统提示
      const sockets = await this.server.fetchSockets();
      const targetSockets: RemoteSocket<any, any>[] = [];
      if (sockets) {
        for (const sock of sockets) {
          const sockAuth = (sock.data as SocketData).auth;
          if (sockAuth?.type === 'agent' && sockAuth.email === toAgentEmail) {
            await sock.join(roomId);
            targetSockets.push(sock);
          }
          // 向访客端推送转接提示（业内最佳实践：访客看到“正在为您转接至 XXX”）
          if (sockAuth?.type === 'client' && sockAuth.email === room.clientEmail) {
            sock.emit('room-transfer-notice', {
              roomId,
              toAgentName,
              transferredBy: auth.email,
            });
          }
        }
      }

      // ⑤ 写入系统消息（对话记录中留下转接/接管痕迹，方便接手坐席查看上下文）
      // 业内最佳实践（Zendesk/Intercom）：区分「接管（转给自己）」与「转接给他人」——
      // 接管记为「X 接管了会话（原负责人：Y）」，避免出现「X 转接给 X」这类语义错乱的记录。
      const sysContent = isSelfTakeover
        ? `${toAgentName} 接管了会话${prevOwnerName ? `（原负责人：${prevOwnerName}）` : ''}${note ? `（备注：${note}）` : ''}`
        : note
          ? `会话已由 ${auth.email} 转接给 ${toAgentName}（备注：${note}）`
          : `会话已由 ${auth.email} 转接给 ${toAgentName}`;
      const updatedRoom = await this.chatRoomService.sendMessage(roomId, {
        content: sysContent,
        sender: 'system',
        senderEmail: 'system@transfer',
      });
      const sysMessage = updatedRoom.messages[updatedRoom.messages.length - 1];

      // 广播系统消息给房间内所有人（此时目标坐席已在房间，能收到）
      this.server.to(roomId).emit('new-message', {
        message: sysMessage,
        room: {
          roomId: updatedRoom.roomId,
          status: updatedRoom.status,
          assignedAgentEmail: updatedRoom.assignedAgentEmail,
          lastActivity: updatedRoom.lastActivity,
          unreadCountForClient: updatedRoom.unreadCountForClient,
          unreadCountForAgent: updatedRoom.unreadCountForAgent,
        },
      });

      // ⑥ 广播状态变更（房间内所有人收到）
      this.server.to(roomId).emit('room-status-changed', {
        roomId,
        status: room.status,
        assignedAgentEmail: toAgentEmail,
        transferred: true,
        transferredBy: auth.email,
      });

      // ⑦ 向目标坐席发送专属转接通知（含备注 + 历史消息，方便快速了解上下文）。
      // 接管（转给自己）时跳过：操作者已打开该会话，无需再收「转接给你」提示，避免重复/困惑 toast；
      // 其状态更新由上方 room-status-changed 广播统一驱动。
      if (!isSelfTakeover) {
        for (const sock of targetSockets) {
          sock.emit('room-transferred-in', {
            roomId,
            clientEmail: room.clientEmail,
            clientName: (room as { clientName?: string }).clientName ?? '',
            transferredBy: auth.email,
            note: note ?? null,
            status: updatedRoom.status,
            assignedAgentEmail: updatedRoom.assignedAgentEmail,
            messages: updatedRoom.messages ?? [],
          });
        }
      }

      // ⑧ 刷新坐席端列表 + 通知计数
      await this.broadcastRoomListUpdate();
      void this.broadcastNotificationCounts();
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
  async handleTyping(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string; text?: string }) {
    const auth = this.getAuth(client);
    if (!auth) return;
    const { roomId, text } = data;
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
      // 实时输入预览（业内最佳实践 LiveChat/Tawk.to）：透传当前输入内容，
      // 截断至 500 字符避免负载过大（1.2s 节流 × 500字 ≈ 可忽略的带宽）
      text: text ? text.slice(0, 500) : undefined,
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

  /**
   * 访客「聊天面板开关」——独立的 engagement（参与度）信号，按业内最佳实践与在线态解耦：
   * 面板打开不改变 online/away（在线态只由「连接 + 标签页可见 + 是否长时间无操作」决定），
   * 仅作为「高意向」提示透传给 B 端（如「访客正在查看对话」）。
   */
  @SubscribeMessage('chat-panel')
  handleChatPanel(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { open?: boolean },
  ) {
    const auth = this.getAuth(client);
    if (!auth || auth.type !== 'client') return;
    const open = body?.open === true;
    void (async () => {
      const userKey = `${auth.email}:${auth.type}`;
      await this.presence.setChatPanelOpen(userKey, open);
      // 刷新坐席端会话列表（含 clientPanelOpen），不改动在线态。
      await this.broadcastRoomListUpdate();
    })();
  }

  @SubscribeMessage('client-gone')
  handleClientGone(@ConnectedSocket() client: Socket) {
    const auth = this.getAuth(client);
    if (!auth) return;
    const userKey = `${auth.email}:${auth.type}`;
    void (async () => {
      const count = await this.presence.removeSocket(userKey, client.id);
      if (count <= 0) {
        // A：访客关闭页面同样进入断线宽限期，避免瞬时缺口误报离线
        await this.schedulePendingOffline(userKey);
        // 关闭页面即视为「已不在查看对话」，立即清除 engagement 信号并刷新坐席列表，
        // 避免 B 端残留「正在查看对话」徽标（不影响在线宽限逻辑）。
        if (auth.type === 'client') {
          await this.presence.setChatPanelOpen(userKey, false);
          await this.broadcastRoomListUpdate();
        }
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
  async handleSetPresence(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { status: PresenceStatus },
  ) {
    const auth = this.getAuth(client);
    if (!auth) return;
    if (data?.status !== 'online' && data?.status !== 'away' && data?.status !== 'offline') {
      return;
    }
    const userKey = `${auth.email}:${auth.type}`;
    // 手动置为 offline：标记 manualOffline，重连不再自动复活；并取消待定离线定时器
    const timer = this.pendingOfflineTimers.get(userKey);
    if (timer) {
      clearTimeout(timer);
      this.pendingOfflineTimers.delete(userKey);
    }
    await this.presence.setManualOffline(userKey, data.status === 'offline');
    void this.setStatusAndBroadcast(userKey, data.status);
    // 坐席从 away/offline 切换为 online → 释放容量，检查等待队列自动派单
    if (auth.type === 'agent' && data.status === 'online') {
      void this.drainWaitingQueue();
    }
  }

  // ── 广播 ──────────────────────────────────────────────

  async broadcastRoomListUpdate() {
    try {
      if (!this.chatRoomService?.getChatRooms) return;
      const result = await this.chatRoomService.getChatRooms({});
      const enriched = await this.enrichRoomsWithPresence(result.rooms);
      const stats = await this.chatRoomService.getChatRoomStats();
      const sockets = await this.server.fetchSockets();
      if (!sockets) return;
      for (const sock of sockets) {
        if (sock.data && (sock.data as SocketData).auth?.type === 'agent') {
          sock.emit('room-list-updated', { rooms: enriched, statusBreakdown: stats.statusBreakdown });
        }
      }
    } catch (error) {
      this.logger.error('Error broadcasting room list update:', error);
    }
  }

  /** 广播在线坐席花名册（仅给坐席端，供转接时选择目标；含 email + 状态 + 显示名 + 工作量）。 */
  private async broadcastAgentRoster(): Promise<void> {
    try {
      const allAgents = await this.presence.getAgentSummaries();
      // 仅保留有活跃 socket 连接的坐席（排除 Redis 中的僵尸/离线记录）
      const agents = allAgents.filter((a) => a.socketCount > 0);
      const emails = agents.map((a) => a.email);
      const details = await this.chatRoomService.getAgentRosterDetails(emails);
      // 仅广播在 User 表中存在的坐席，过滤测试/探针连接
      const payload = {
        agents: agents
          .filter((a) => details.has(a.email))
          .map((a) => {
            const d = details.get(a.email)!;
            return {
              email: a.email,
              status: a.status,
              name: d.name,
              activeRoomCount: d.activeRoomCount,
            };
          }),
      };
      const sockets = await this.server.fetchSockets();
      if (!sockets) return;
      for (const sock of sockets) {
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
      if (!this.chatRoomService?.getNotificationCounts) return;
      const byUser = new Map<
        string,
        { email: string; type: 'client' | 'agent'; sockets: RemoteSocket<any, any>[] }
      >();
      const sockets = await this.server.fetchSockets();
      if (!sockets) return;
      for (const sock of sockets) {
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
