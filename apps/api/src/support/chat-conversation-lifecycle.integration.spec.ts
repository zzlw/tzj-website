import type { Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatGateway } from './chat.gateway';
import { ChatPresenceStore } from './chat-presence.store';
import { ChatAuthService } from './chat-auth.service';
import type { ChatRoomListItem, ChatRoomResult } from './chat-room.service';

// 轻量内存 ChatRoomService（仅实现网关用到的查询/变更方法），用于端到端驱动真实网关 handler
class FakeRoomService {
  rooms = new Map<string, ChatRoomResult>();

  constructor(seed: ChatRoomResult[]) {
    for (const r of seed) this.rooms.set(r.roomId, structuredClone(r));
  }

  async getChatRooms(): Promise<{ rooms: ChatRoomResult[]; total: number }> {
    const rooms = [...this.rooms.values()];
    return { rooms, total: rooms.length };
  }

  async getChatRoomById(roomId: string): Promise<ChatRoomResult | null> {
    return this.rooms.get(roomId) ?? null;
  }

  async updateChatRoom(
    roomId: string,
    data: Partial<ChatRoomResult>,
  ): Promise<ChatRoomResult> {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('room not found');
    const next = { ...room, ...data };
    this.rooms.set(roomId, next);
    return next;
  }

  async closeChatRoom(roomId: string): Promise<ChatRoomResult> {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('room not found');
    const closed: ChatRoomResult = {
      ...room,
      status: 'closed',
      closedAt: new Date(),
      messages: room.messages ?? [],
    };
    this.rooms.set(roomId, closed);
    return closed;
  }
}

interface SocketData {
  auth?: { type?: 'client' | 'agent'; email?: string; role?: string };
  userKey?: string;
}

// 最小 socket.io 兼容桩：支持 join/leave（房间成员关系是本测试的核心）、to/emit、handshake、disconnect
class FakeSocket {
  id: string;
  data: SocketData = {};
  rooms = new Set<string>();
  connected = true;
  handshake: { auth: { token?: string } } = { auth: {} };
  private handlers = new Map<string, (p: unknown) => void>();
  private server: FakeServer;

  constructor(id: string, server: FakeServer) {
    this.id = id;
    this.server = server;
  }

  on(event: string, cb: (p: unknown) => void) {
    this.handlers.set(event, cb);
    return this;
  }

  emit(event: string, payload: unknown) {
    this.server.dispatch(this.id, event, payload);
    return this;
  }

  join(roomId: string) {
    this.rooms.add(roomId);
    return this;
  }

  leave(roomId: string) {
    this.rooms.delete(roomId);
    return this;
  }

  to(_roomId: string) {
    return {
      emit: (event: string, payload: unknown) => {
        this.server.dispatchToRoom(_roomId, this.id, event, payload);
        return this;
      },
    };
  }

  disconnect() {
    this.connected = false;
    return this;
  }
}

class FakeServer {
  sockets = new Map<string, FakeSocket>();
  private listeners = new Map<string, ((s: FakeSocket) => void)[]>();
  received = new Map<string, { event: string; payload: unknown }[]>();

  on(event: 'connection', cb: (s: FakeSocket) => void) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), cb]);
    return this;
  }

  register(sock: FakeSocket) {
    this.sockets.set(sock.id, sock);
    this.received.set(sock.id, []);
    for (const cb of this.listeners.get('connection') ?? []) cb(sock);
  }

  unregister(id: string) {
    this.sockets.delete(id);
  }

  dispatch(fromId: string, event: string, payload: unknown) {
    const arr = this.received.get(fromId) ?? [];
    arr.push({ event, payload });
    this.received.set(fromId, arr);
  }

  dispatchToRoom(roomId: string, exceptId: string, event: string, payload: unknown) {
    for (const [id, sock] of this.sockets) {
      if (id === exceptId) continue;
      if (!sock.rooms.has(roomId)) continue;
      const arr = this.received.get(id) ?? [];
      arr.push({ event, payload });
      this.received.set(id, arr);
    }
  }

  // 网关 broadcastRoomListUpdate 通过 fetchSockets 向坐席端投递
  async fetchSockets() {
    return Array.from(this.sockets.values());
  }

  // server.to(room).emit(...)：向房间内除触发者外的 socket 投递
  to(roomId: string) {
    return {
      emit: (event: string, payload: unknown) => {
        this.dispatchToRoom(roomId, '', event, payload);
        return this;
      },
    };
  }

  // server.emit(...)：全局广播（如 presence-changed），记录到所有 socket
  emit(event: string, payload: unknown) {
    for (const id of this.sockets.keys()) this.dispatch(id, event, payload);
    return this;
  }
}

const JWT_SECRET = 'test-secret';
process.env.JWT_SECRET = JWT_SECRET;
const authService = new ChatAuthService(new JwtService({ secret: JWT_SECRET }), new ConfigService());

const VISITOR = 'visitor@example.com';
const NEW_GUEST = 'new-guest@example.com';
const AGENT_EMAIL = 'agent@example.com';

function clientToken(roomId: string, email: string) {
  return authService.issueClientToken(roomId, email);
}
function agentToken() {
  return authService.issueAgentToken('agent-1', AGENT_EMAIL, 'admin');
}

const roomSeed: ChatRoomResult[] = [
  {
    roomId: 'R1',
    clientName: '访客',
    clientEmail: VISITOR,
    status: 'open',
    createdAt: new Date(),
    updatedAt: new Date(),
    unreadCount: 0,
    messages: [],
  } as unknown as ChatRoomResult,
  {
    roomId: 'R2',
    clientName: '新访客',
    clientEmail: NEW_GUEST,
    status: 'open',
    createdAt: new Date(),
    updatedAt: new Date(),
    unreadCount: 0,
    messages: [],
  } as unknown as ChatRoomResult,
];

function eventsFor(server: FakeServer, sockId: string, event: string) {
  return (server.received.get(sockId) ?? [])
    .filter((e) => e.event === event)
    .map((e) => e.payload);
}

function findRoom(payload: unknown, roomId: string): ChatRoomListItem | undefined {
  const rooms = (payload as { rooms?: ChatRoomListItem[] })?.rooms ?? [];
  return rooms.find((r) => r.roomId === roomId);
}

describe('聊天会话生命周期：结束对话 → 开始新对话（按房间在线态）', () => {
  let server: FakeServer;
  let gateway: ChatGateway;
  let visitor: FakeSocket;
  let newGuest: FakeSocket | null = null;
  let agent: FakeSocket;

  afterAll(() => {
    // 清理断线宽限期定时器，避免 Jest 进程悬挂
    const timers = (
      gateway as unknown as { pendingOfflineTimers: Map<unknown, ReturnType<typeof setTimeout>> }
    ).pendingOfflineTimers;
    for (const t of timers.values()) clearTimeout(t);
    timers.clear();
  });

  beforeAll(async () => {
    server = new FakeServer();
    const presence = new ChatPresenceStore(null);
    const roomService = new FakeRoomService(roomSeed);
    gateway = new ChatGateway(roomService as never, authService, presence, null);
    (gateway as unknown as { server: Server }).server = server as unknown as Server;

    // 坐席端连接 + 注册 + 加入活跃房间
    agent = new FakeSocket('a1', server);
    agent.handshake = { auth: { token: agentToken() } };
    server.sockets.set(agent.id, agent);
    server.received.set(agent.id, []);
    await gateway.handleConnection(agent);
    await gateway.handleRegisterAgent(agent, { email: AGENT_EMAIL, role: 'agent' });

    // 访客连接 + 进入 R1（真实流程：连接后 enterChat → joinRoom）
    visitor = new FakeSocket('v1', server);
    visitor.handshake = { auth: { token: clientToken('R1', VISITOR) } };
    server.sockets.set(visitor.id, visitor);
    server.received.set(visitor.id, []);
    await gateway.handleConnection(visitor);
    await gateway.handleJoinRoom(visitor, { roomId: 'R1' });
  });

  it('1) 结束后：R1 关闭且访客在线（在房间内）', async () => {
    await gateway.handleUpdateRoomStatus(agent, { roomId: 'R1', status: 'closed', closedBy: 'agent' });
    const closed = eventsFor(server, 'a1', 'room-list-updated').pop() as
      | { rooms: ChatRoomListItem[] }
      | undefined;
    expect(closed).toBeTruthy();
    expect(findRoom(closed, 'R1')?.status).toBe('closed');
    expect(findRoom(closed, 'R1')?.clientPresence).toBe('online');
  });

  it('2) 开始新对话（leave-room）：旧会话离线，访客全局仍在线，不广播全局 offline', async () => {
    await gateway.handleLeaveRoom(visitor, { roomId: 'R1' });

    // 向 B 端广播房间列表（模拟刷新 / B 端拉取），按房间成员关系判定
    await gateway.broadcastRoomListUpdate();
    const list = eventsFor(server, 'a1', 'room-list-updated').pop() as
      | { rooms: ChatRoomListItem[] }
      | undefined;
    // 关键修复点：离开房间后旧会话应显示离线（而非仍在线）
    expect(findRoom(list, 'R1')?.clientPresence).toBe('offline');

    // 访客 socket 仍在线（全局在线态不变）——只是不再在 R1 房间内
    const globalStatus = await gateway['presence'].getPresence(`${VISITOR}:client`);
    expect(globalStatus).toBe('online');

    // 不应广播任何「访客全局离线」的 presence-changed
    const offlines = eventsFor(server, 'a1', 'presence-changed').filter(
      (p) =>
        (p as { userEmail?: string; status?: string }).userEmail === VISITOR &&
        (p as { status?: string }).status === 'offline',
    );
    expect(offlines.length).toBe(0);
  });

  it('3) 访客以新匿名身份进入新会话：R2 在线、R1 仍离线', async () => {
    newGuest = new FakeSocket('g1', server);
    newGuest.handshake = { auth: { token: clientToken('R2', NEW_GUEST) } };
    server.sockets.set(newGuest.id, newGuest);
    server.received.set(newGuest.id, []);
    await gateway.handleConnection(newGuest);
    await gateway.handleJoinRoom(newGuest, { roomId: 'R2' });

    await gateway.broadcastRoomListUpdate();
    const list = eventsFor(server, 'a1', 'room-list-updated').pop() as
      | { rooms: ChatRoomListItem[] }
      | undefined;
    expect(findRoom(list, 'R2')?.clientPresence).toBe('online');
    expect(findRoom(list, 'R1')?.clientPresence).toBe('offline');
  });

  it('4) 访客真正关页断开：宽限期内乐观保持在线，旧会话按房间离线、新会话在线', async () => {
    await gateway.handleDisconnect(visitor);
    const status = await gateway['presence'].getPresence(`${VISITOR}:client`);
    expect(status).toBe('online'); // 60s 宽限
    await gateway.broadcastRoomListUpdate();
    const list = eventsFor(server, 'a1', 'room-list-updated').pop() as
      | { rooms: ChatRoomListItem[] }
      | undefined;
    expect(findRoom(list, 'R1')?.clientPresence).toBe('offline');
    expect(findRoom(list, 'R2')?.clientPresence).toBe('online');
  });
});
