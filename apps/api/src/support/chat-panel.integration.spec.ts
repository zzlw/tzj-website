import { ChatGateway } from './chat.gateway';
import { ChatPresenceStore } from './chat-presence.store';

// 轻量 harness：仅校验 presence 语义，不依赖真实 chatRoomService / socket.io
class FakeServer {
  emitted: { event: string; payload: unknown }[] = [];
  emit(event: string, payload?: unknown) {
    this.emitted.push({ event, payload });
    return this;
  }
  to() {
    return { emit: () => this };
  }
  async fetchSockets() {
    return [] as never[];
  }
}

class FakeSocket {
  id: string;
  data: { auth: { email: string; type: 'client' | 'agent' }; userKey?: string };
  rooms = new Set<string>();
  constructor(id: string, auth: { email: string; type: 'client' | 'agent' }) {
    this.id = id;
    this.data = { auth, userKey: `${auth.email}:${auth.type}` };
    this.rooms.add(id);
  }
  leave(room: string) {
    this.rooms.delete(room);
    return this;
  }
  join(room: string) {
    this.rooms.add(room);
    return this;
  }
}

const CLIENT_EMAIL = 'visitor@example.com';
const USER_KEY = `${CLIENT_EMAIL}:client`;

describe('chat-panel: engagement 信号与在线态解耦（业内最佳实践）', () => {
  let server: FakeServer;
  let presence: ChatPresenceStore;
  let gateway: ChatGateway;

  beforeAll(() => {
    server = new FakeServer();
    presence = new ChatPresenceStore(null);
    gateway = new ChatGateway(
      null as never,
      null as never,
      presence,
      null as never,
      null,
    ) as unknown as ChatGateway;
    gateway.server = server as never;
  });

  afterAll(async () => {
    // 清理网关内部定时器，避免 Jest 无法退出
    await gateway.beforeApplicationShutdown();
  });

  const visitor = () => new FakeSocket('v1', { email: CLIENT_EMAIL, type: 'client' });

  it('1) 访客连接 → 默认 online（首次连接，非手动离线）', async () => {
    await gateway.handleConnectPresence(visitor(), USER_KEY, {
      email: CLIENT_EMAIL,
      type: 'client',
    } as never);
    expect(await presence.getPresence(USER_KEY)).toBe('online');
  });

  it('2) 打开聊天面板：仅记录 chatPanelOpen=true，不翻转在线态', async () => {
    server.emitted.length = 0;
    await gateway.handleChatPanel(visitor(), { open: true });

    // 在线态保持 online（核心回归：旧实现打开/关闭面板会置 away/online）
    expect(await presence.getPresence(USER_KEY)).toBe('online');
    // engagement 信号已记录
    expect((await presence.getMeta(USER_KEY))?.chatPanelOpen).toBe(true);
    // 不应广播任何 presence-changed（面板开关不属 presence 变化）
    expect(server.emitted.some((e) => e.event === 'presence-changed')).toBe(false);
  });

  it('3) 关闭聊天面板：chatPanelOpen=false，在线态仍保持 online', async () => {
    await gateway.handleChatPanel(visitor(), { open: false });
    expect(await presence.getPresence(USER_KEY)).toBe('online');
    expect((await presence.getMeta(USER_KEY))?.chatPanelOpen).toBe(false);
  });

  it('4) 即使访客处在「站点可见、面板收起」状态，也应是在线（不再因面板收起被判 away）', async () => {
    // 模拟：标签页可见、未打开面板（panel=false），但仍应 online
    await gateway.handleChatPanel(visitor(), { open: false });
    // 旧实现：面板收起 → reportIdle → away。现在在线态只看连接+可见，与面板无关。
    expect(await presence.getPresence(USER_KEY)).toBe('online');
  });

  it('5) 非 client（坐席）发送的 chat-panel 被忽略', async () => {
    const agent = new FakeSocket('a1', { email: 'agent@tzj.com', type: 'agent' });
    await gateway.handleChatPanel(agent as never, { open: true });
    // 坐席无 chatPanelOpen 概念，不应影响该访客的 engagement 信号
    expect((await presence.getMeta(USER_KEY))?.chatPanelOpen).toBe(false);
  });

  it('6) 访客打开面板后关闭页面（disconnect，socket 归零）→ chatPanelOpen 重置为 false', async () => {
    const v = visitor();
    await gateway.handleConnectPresence(v as never, USER_KEY, {
      email: CLIENT_EMAIL,
      type: 'client',
    } as never);
    // 打开面板 → engagement=true
    await gateway.handleChatPanel(v as never, { open: true });
    expect((await presence.getMeta(USER_KEY))?.chatPanelOpen).toBe(true);

    // 关闭页面（直接关标签/浏览器）：socket 归零，pagehide 的 chat-panel:false 可能发不出，
    // 断线处理必须清除 engagement 信号，避免 B 端残留「正在查看对话」。
    await gateway.handleDisconnect(v as never);
    expect((await presence.getMeta(USER_KEY))?.chatPanelOpen).toBe(false);
  });
});
