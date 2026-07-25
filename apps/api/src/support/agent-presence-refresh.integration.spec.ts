/**
 * 复现并锁死「客服锁屏离开很久后，解锁显示在线、刷新却回到离线」的竞态。
 *
 * 根因：ChatGateway.handleConnectPresence 用 `prevCount === 0` 作为「重连才恢复在线」
 * 的门槛；刷新瞬间旧 socket 往往尚未从 store 移除（prevCount===1），于是跳过恢复在线，
 * 继承了旧 socket 当时已 offline/away 的状态，通过 my-presence 把 offline 发给新客户端；
 * 而 ChatPresenceProvider 只认 my-presence、忽略 presence-changed，于是刷新后一直离线。
 *
 * 修复后：只要有 socket 连上（含刷新/重连/换设备）且非 manualOffline，即置为 online，
 * my-presence 正确返回 online；客户端也兜底消费自身 presence-changed。
 */
import { ChatGateway } from './chat.gateway';
import { ChatPresenceStore } from './chat-presence.store';

const AGENT_EMAIL = 'agent-refresh@tzj.com';
const userKey = `${AGENT_EMAIL}:agent`;

class FakeSocket {
  id: string;
  data: { auth: { email: string; type: 'client' | 'agent'; userKey?: string }; userKey?: string };
  rooms = new Set<string>();
  received: { event: string; payload: unknown }[] = [];

  constructor(id: string) {
    this.id = id;
    this.data = { auth: { email: '', type: 'agent' } };
  }
  emit(event: string, payload?: unknown) {
    this.received.push({ event, payload });
    return this;
  }
  join(room: string) {
    this.rooms.add(room);
    return this;
  }
  leave(room: string) {
    this.rooms.delete(room);
    return this;
  }
  disconnect() {
    return this;
  }
}

class FakeServer {
  sockets = new Map<string, FakeSocket>();
  register(s: FakeSocket) {
    this.sockets.set(s.id, s);
  }
  async fetchSockets() {
    return [...this.sockets.values()];
  }
  emit(event: string, payload?: unknown) {
    for (const s of this.sockets.values()) s.emit(event, payload);
    return this;
  }
  to() {
    return { emit: () => this };
  }
  in() {
    return { fetchSockets: async () => [] as FakeSocket[] };
  }
}

function makeAgentClient(id: string): FakeSocket {
  const s = new FakeSocket(id);
  s.data = { auth: { email: AGENT_EMAIL, type: 'agent', userKey }, userKey };
  return s;
}

// 仅暴露 presence 测试所需的私有方法，避免使用 any
type PresenceGateway = {
  server: FakeServer;
  handleConnectPresence(
    client: FakeSocket,
    userKey: string,
    auth: { email: string; type: 'client' | 'agent' },
  ): Promise<void>;
  handleDisconnect(client: FakeSocket): Promise<void>;
  setStatusAndBroadcast(
    userKey: string,
    status: 'online' | 'away' | 'offline',
  ): Promise<void>;
  handleSetPresence(
    client: FakeSocket,
    data: { status: 'online' | 'away' | 'offline' },
  ): Promise<void>;
};

describe('agent presence: refresh-after-idle race', () => {
  let server: FakeServer;
  let presence: ChatPresenceStore;
  let gateway: PresenceGateway;
  let gatewayInstance: ChatGateway;

  beforeAll(() => {
    server = new FakeServer();
    presence = new ChatPresenceStore(null);
    // chatRoomService / chatAuth / ipBanService 在 presence 路径中不被使用，传入 null 占位
    gatewayInstance = new ChatGateway(null as never, null as never, presence, null as never, null);
    gateway = gatewayInstance as unknown as PresenceGateway;
    gateway.server = server;
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  afterAll(async () => {
    // 清理网关内部定时器，避免 Jest 无法退出
    await gatewayInstance.beforeApplicationShutdown();
  });

  const getStatus = () => presence.getPresence(userKey);
  const presenceChangedTo = (socks: FakeSocket[], status: string) =>
    socks
      .flatMap((s) => s.received)
      .some((e) => e.event === 'presence-changed' && (e.payload as { status: string }).status === status);

  it('1) 刷新竞态：旧 socket 仍在（prevCount=1）且空闲已 offline，新连接必须恢复 online', async () => {
    // 首次连接 → 在线
    const a1 = makeAgentClient('a1');
    server.register(a1);
    await gateway.handleConnectPresence(a1, userKey, a1.data.auth);
    expect(await getStatus()).toBe('online');

    // 模拟「锁屏离开很久」：scanPresence 在 socket 仍存活时把坐席置为 offline
    await gateway.setStatusAndBroadcast(userKey, 'offline');
    expect(await getStatus()).toBe('offline');

    // 关键：刷新瞬间旧 socket 尚未移除（prevCount=1），新连接（刷新页面）建立
    const a2 = makeAgentClient('a2');
    server.register(a2);
    await gateway.handleConnectPresence(a2, userKey, a2.data.auth);

    // 修复后：连接即在线（服务端真相），并广播 presence-changed:online
    // （客户端 ChatPresenceProvider 现已兜底消费自身 presence-changed，故刷新后一致在线）
    expect(await getStatus()).toBe('online');
    expect(presenceChangedTo([a1, a2], 'online')).toBe(true);
  });

  it('2) 真正断线（宽限期超时）后重连，必须恢复 online', async () => {
    const a1 = makeAgentClient('a1');
    server.register(a1);
    await gateway.handleConnectPresence(a1, userKey, a1.data.auth);

    // 模拟旧 socket 断开 → 进入宽限期（乐观保持在线）
    await gateway.handleDisconnect(a1);
    expect(await getStatus()).toBe('online');

    // 模拟宽限期超时后真正离线（直接置 offline，避免依赖真实 60s 定时器）
    await gateway.setStatusAndBroadcast(userKey, 'offline');
    expect(await getStatus()).toBe('offline');

    // 重连（prevCount=0）→ 恢复 online
    const a2 = makeAgentClient('a2');
    server.register(a2);
    await gateway.handleConnectPresence(a2, userKey, a2.data.auth);
    expect(await getStatus()).toBe('online');
    expect(presenceChangedTo([a1, a2], 'online')).toBe(true);
  });

  it('3) 手动离线后重连不自动复活为在线', async () => {
    const a1 = makeAgentClient('a1');
    server.register(a1);
    await gateway.handleConnectPresence(a1, userKey, a1.data.auth);

    // 手动置离线
    await gateway.handleSetPresence(a1, { status: 'offline' } as { status: 'offline' });
    expect(await getStatus()).toBe('offline');

    // 断开 + 重连
    await gateway.handleDisconnect(a1);
    const a2 = makeAgentClient('a2');
    server.register(a2);
    await gateway.handleConnectPresence(a2, userKey, a2.data.auth);
    expect(await getStatus()).toBe('offline');
  });
});
