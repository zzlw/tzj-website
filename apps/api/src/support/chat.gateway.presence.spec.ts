import 'reflect-metadata';
import { ChatGateway } from './chat.gateway';

type PresenceStatus = 'online' | 'away' | 'offline';

type AnyMeta = {
  email: string;
  userType: 'agent' | 'client';
  status: PresenceStatus;
  manualOffline: boolean;
  lastSeen: number;
  socketCount: number;
};

/** 内存模拟的 ChatPresenceStore，仅实现 gateway 实际调用到的方法。 */
class FakePresence {
  private metas = new Map<string, AnyMeta>();
  private counts = new Map<string, number>();

  setMeta(userKey: string, meta: AnyMeta) {
    this.metas.set(userKey, meta);
  }
  setCount(userKey: string, n: number) {
    this.counts.set(userKey, n);
  }

  async getMeta(userKey: string): Promise<AnyMeta | null> {
    return this.metas.get(userKey) ?? null;
  }
  async getPresence(userKey: string): Promise<PresenceStatus> {
    return this.metas.get(userKey)?.status ?? 'offline';
  }
  async getSocketCount(userKey: string): Promise<number> {
    return this.counts.get(userKey) ?? 0;
  }
  async setStatus(userKey: string, status: PresenceStatus): Promise<void> {
    const m = this.metas.get(userKey);
    if (m) m.status = status;
  }
  async setLastSeen(userKey: string, t: number): Promise<void> {
    const m = this.metas.get(userKey);
    if (m) m.lastSeen = t;
  }
  async getAgentSummaries(): Promise<AnyMeta[]> {
    return [...this.metas.values()].filter((m) => m.userType === 'agent');
  }
  async addSocket(
    userKey: string,
    email: string,
    type: 'agent' | 'client',
    _id: string,
  ): Promise<void> {
    const m = this.metas.get(userKey);
    if (m) {
      m.socketCount += 1;
    } else {
      this.metas.set(userKey, {
        email,
        userType: type,
        status: 'online',
        manualOffline: false,
        lastSeen: Date.now(),
        socketCount: 1,
      });
    }
    this.counts.set(userKey, (this.counts.get(userKey) ?? 0) + 1);
  }
}

// 与 chat.gateway.ts 中的 OFFLINE_GRACE_MS 保持一致
const OFFLINE_GRACE_MS = 60_000;

function makeGateway(presence: FakePresence) {
  const emits: Array<{ event: string; payload: Record<string, unknown> }> = [];
  const server: any = {
    emit: (event: string, payload: Record<string, unknown>) => emits.push({ event, payload }),
    to: () => ({ emit: () => {} }),
    fetchSockets: async () => [],
  };
  const gateway: any = new ChatGateway({} as any, {} as any, presence as any, null as any);
  gateway.server = server;
  return { gateway, emits };
}

describe('ChatGateway.schedulePendingOffline（断线宽限：乐观保持在线）', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('断线瞬间不广播 away，状态保持 online（防 C 端闪现「离开中」）', async () => {
    const presence = new FakePresence();
    const userKey = 'agent1@tzj.com:agent';
    presence.setMeta(userKey, {
      email: 'agent1@tzj.com',
      userType: 'agent',
      status: 'online',
      manualOffline: false,
      lastSeen: Date.now(),
      socketCount: 1,
    });
    presence.setCount(userKey, 0); // 模拟 socket 已被移除（切桌面）
    const { gateway, emits } = makeGateway(presence);

    await gateway.schedulePendingOffline(userKey);

    const awayEmits = emits.filter(
      (e) => e.event === 'presence-changed' && e.payload.status === 'away',
    );
    expect(awayEmits).toHaveLength(0);
    expect(emits).toHaveLength(0); // 宽限期内不应有任何状态广播
    expect((await presence.getMeta(userKey))!.status).toBe('online');
  });

  it('宽限期到期且未重连 → 判定 offline 并广播', async () => {
    const presence = new FakePresence();
    const userKey = 'agent1@tzj.com:agent';
    presence.setMeta(userKey, {
      email: 'agent1@tzj.com',
      userType: 'agent',
      status: 'online',
      manualOffline: false,
      lastSeen: Date.now(),
      socketCount: 1,
    });
    presence.setCount(userKey, 0);
    const { gateway, emits } = makeGateway(presence);

    await gateway.schedulePendingOffline(userKey);
    await jest.advanceTimersByTimeAsync(OFFLINE_GRACE_MS);

    expect((await presence.getMeta(userKey))!.status).toBe('offline');
    const offlineEmits = emits.filter(
      (e) => e.event === 'presence-changed' && e.payload.status === 'offline',
    );
    expect(offlineEmits.length).toBeGreaterThanOrEqual(1);
  });

  it('宽限期内重连（切桌面后新设备接入） → 取消定时器，状态恢复 online，不广播 offline', async () => {
    const presence = new FakePresence();
    const userKey = 'agent1@tzj.com:agent';
    presence.setMeta(userKey, {
      email: 'agent1@tzj.com',
      userType: 'agent',
      status: 'online',
      manualOffline: false,
      lastSeen: Date.now(),
      socketCount: 1,
    });
    presence.setCount(userKey, 0);
    const { gateway, emits } = makeGateway(presence);

    await gateway.schedulePendingOffline(userKey);
    const fakeClient: any = { id: 'sock-new' };
    const auth: any = { email: 'agent1@tzj.com', type: 'agent' };
    await gateway.handleConnectPresence(fakeClient, userKey, auth);

    await jest.advanceTimersByTimeAsync(OFFLINE_GRACE_MS);

    expect((await presence.getMeta(userKey))!.status).toBe('online');
    const offlineEmits = emits.filter(
      (e) => e.event === 'presence-changed' && e.payload.status === 'offline',
    );
    expect(offlineEmits).toHaveLength(0);
  });

  it('手动离线的用户断线后不排程、保持 offline', async () => {
    const presence = new FakePresence();
    const userKey = 'agent2@tzj.com:agent';
    presence.setMeta(userKey, {
      email: 'agent2@tzj.com',
      userType: 'agent',
      status: 'offline',
      manualOffline: true,
      lastSeen: Date.now(),
      socketCount: 0,
    });
    presence.setCount(userKey, 0);
    const { gateway } = makeGateway(presence);

    await gateway.schedulePendingOffline(userKey);
    await jest.advanceTimersByTimeAsync(OFFLINE_GRACE_MS);

    expect((await presence.getMeta(userKey))!.status).toBe('offline');
  });
});

describe('ChatGateway user-idle / user-active（空闲信号不得覆盖手动离线）', () => {
  function makeAgentClient(email: string): any {
    return {
      id: 'sock-1',
      data: { auth: { email, type: 'agent' } },
      disconnect: () => {},
    };
  }

  function makeManualOfflineAgent(presence: FakePresence, email: string): string {
    const userKey = `${email}:agent`;
    presence.setMeta(userKey, {
      email,
      userType: 'agent',
      status: 'offline',
      manualOffline: true,
      lastSeen: Date.now(),
      socketCount: 1, // socket 仍连着（手动离线不断连）
    });
    presence.setCount(userKey, 1);
    return userKey;
  }

  it('user-idle 只做 online → away 降级：手动离线的坐席切走标签页后仍保持 offline', async () => {
    const presence = new FakePresence();
    const userKey = makeManualOfflineAgent(presence, 'agent3@tzj.com');
    const { gateway, emits } = makeGateway(presence);

    gateway.handleUserIdle(makeAgentClient('agent3@tzj.com'));
    await new Promise((r) => setImmediate(r)); // 排空 handler 内部的 fire-and-forget 异步链

    expect((await presence.getMeta(userKey))!.status).toBe('offline');
    expect(emits.filter((e) => e.payload?.status === 'away')).toHaveLength(0);
  });

  it('user-idle 对 online 坐席正常降级为 away', async () => {
    const presence = new FakePresence();
    const userKey = 'agent4@tzj.com:agent';
    presence.setMeta(userKey, {
      email: 'agent4@tzj.com',
      userType: 'agent',
      status: 'online',
      manualOffline: false,
      lastSeen: Date.now(),
      socketCount: 1,
    });
    presence.setCount(userKey, 1);
    const { gateway } = makeGateway(presence);

    gateway.handleUserIdle(makeAgentClient('agent4@tzj.com'));
    await new Promise((r) => setImmediate(r));

    expect((await presence.getMeta(userKey))!.status).toBe('away');
  });

  it('user-active 不复活手动离线的坐席', async () => {
    const presence = new FakePresence();
    const userKey = makeManualOfflineAgent(presence, 'agent5@tzj.com');
    const { gateway } = makeGateway(presence);

    gateway.handleUserActive(makeAgentClient('agent5@tzj.com'));
    await new Promise((r) => setImmediate(r));

    expect((await presence.getMeta(userKey))!.status).toBe('offline');
  });
});
