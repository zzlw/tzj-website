import { randomUUID } from 'node:crypto';
import type { RedisClientType } from 'redis';

export type PresenceStatus = 'online' | 'away' | 'offline';

export interface PresenceSummary {
  userKey: string;
  email: string;
  userType: 'client' | 'agent';
  status: PresenceStatus;
  lastSeen: number;
  socketCount: number;
  /** 是否由用户「主动」置为离线（手动下线）。手动离线的用户在重连后不应自动复活为在线。 */
  manualOffline: boolean;
  /** 访客是否「当前打开了聊天面板」（独立 engagement 信号，不影响 online/away）。 */
  chatPanelOpen: boolean;
}

const SOCKET_TTL_MS = 90_000;

/**
 * 在线状态存储。
 *
 * 设计目标（P1 H1）：多实例部署下，所有实例共享同一份 presence 真相，
 * 配合 Socket.IO Redis Adapter，使「某访客在线 / 某坐席离开」的广播在任意实例都一致，
 * 消除重启抖动与跨实例状态分裂。
 *
 * 后端选择：
 *  - 配置了 REDIS_URL → Redis 模式（真相在 Redis，跨实例一致）
 *  - 未配置 → 内存模式（单实例开发/自托管，行为等价）
 *
 * socket 成员用 Redis 有序集合 `{userKey} -> member=instanceId:socketId, score=过期时间戳` 管理，
 * 天然支持「单 socket 独立 TTL」：崩溃/掉线未触发 remove 时，ZREMRANGEBYSCORE 自动清理，
 * 不会误伤同城其他在线 socket。无 Redis 时用 Set 近似。
 */
export class ChatPresenceStore {
  private readonly instanceId = randomUUID().slice(0, 8);
  private readonly mem = new Map<
    string,
    {
      email: string;
      userType: 'client' | 'agent';
      status: PresenceStatus;
      lastSeen: number;
      sockets: Set<string>;
      manualOffline: boolean;
      /** 访客是否当前打开了聊天面板（engagement 信号，独立于在线态）。 */
      chatPanelOpen: boolean;
    }
  >();

  constructor(private readonly redis: RedisClientType | null) {}

  private metaKey(userKey: string) {
    return `chat:p:meta:${userKey}`;
  }
  private socketsKey(userKey: string) {
    return `chat:p:sockets:${userKey}`;
  }
  private readonly keysSet = 'chat:p:keys';

  async addSocket(
    userKey: string,
    email: string,
    userType: 'client' | 'agent',
    socketId: string,
  ): Promise<number> {
    if (this.redis) {
      const now = Date.now();
      const member = `${this.instanceId}:${socketId}`;
      await this.redis.sAdd(this.keysSet, userKey);
      // 注意：不在此处写 manualOffline，避免重连时覆盖用户「手动离线」标记。
      await this.redis.hSet(this.metaKey(userKey), {
        email,
        userType,
        lastSeen: String(now),
      });
      await this.redis.zAdd(this.socketsKey(userKey), {
        score: now + SOCKET_TTL_MS,
        value: member,
      });
      await this.redis.zRemRangeByScore(this.socketsKey(userKey), 0, now);
      return this.redis.zCount(this.socketsKey(userKey), now, '+inf');
    }
    let entry = this.mem.get(userKey);
    if (!entry) {
      entry = {
        email,
        userType,
        status: 'offline',
        lastSeen: Date.now(),
        sockets: new Set(),
        manualOffline: false,
        chatPanelOpen: false,
      };
      this.mem.set(userKey, entry);
    } else {
      entry.email = email;
      entry.userType = userType;
    }
    entry.sockets.add(socketId);
    return entry.sockets.size;
  }

  async removeSocket(userKey: string, socketId: string): Promise<number> {
    if (this.redis) {
      const member = `${this.instanceId}:${socketId}`;
      await this.redis.zRem(this.socketsKey(userKey), member);
      const now = Date.now();
      await this.redis.zRemRangeByScore(this.socketsKey(userKey), 0, now);
      return this.redis.zCount(this.socketsKey(userKey), now, '+inf');
    }
    const entry = this.mem.get(userKey);
    if (!entry) return 0;
    entry.sockets.delete(socketId);
    return entry.sockets.size;
  }

  /** 心跳/活跃时续命本实例持有的 socket，避免被 TTL 误清。 */
  async refreshSocket(userKey: string, socketId: string): Promise<void> {
    if (this.redis) {
      const now = Date.now();
      await this.redis.zAdd(this.socketsKey(userKey), {
        score: now + SOCKET_TTL_MS,
        value: `${this.instanceId}:${socketId}`,
      });
    }
  }

  async getSocketCount(userKey: string): Promise<number> {
    if (this.redis) {
      const now = Date.now();
      await this.redis.zRemRangeByScore(this.socketsKey(userKey), 0, now);
      return this.redis.zCount(this.socketsKey(userKey), now, '+inf');
    }
    return this.mem.get(userKey)?.sockets.size ?? 0;
  }

  async setStatus(userKey: string, status: PresenceStatus, lastSeen = Date.now()): Promise<void> {
    if (this.redis) {
      await this.redis.hSet(this.metaKey(userKey), {
        status,
        lastSeen: String(lastSeen),
      });
      return;
    }
    const entry = this.mem.get(userKey);
    if (entry) {
      entry.status = status;
      entry.lastSeen = lastSeen;
    }
  }

  async getMeta(userKey: string): Promise<{
    email: string;
    userType: 'client' | 'agent';
    status: PresenceStatus;
    lastSeen: number;
    manualOffline: boolean;
    chatPanelOpen: boolean;
  } | null> {
    if (this.redis) {
      const raw = await this.redis.hGetAll(this.metaKey(userKey));
      if (!raw || !raw.email) return null;
      return {
        email: raw.email,
        userType: (raw.userType as 'client' | 'agent') ?? 'client',
        status: (raw.status as PresenceStatus) ?? 'offline',
        lastSeen: raw.lastSeen ? Number(raw.lastSeen) : 0,
        manualOffline: raw.manualOffline === 'true',
        chatPanelOpen: raw.chatPanelOpen === 'true',
      };
    }
    const entry = this.mem.get(userKey);
    if (!entry) return null;
    return {
      email: entry.email,
      userType: entry.userType,
      status: entry.status,
      lastSeen: entry.lastSeen,
      manualOffline: entry.manualOffline ?? false,
      chatPanelOpen: entry.chatPanelOpen ?? false,
    };
  }

  /** 标记用户是否「主动」离线。手动离线者在重连后不应自动复活为在线。 */
  async setManualOffline(userKey: string, flag: boolean): Promise<void> {
    if (this.redis) {
      await this.redis.hSet(this.metaKey(userKey), { manualOffline: flag ? 'true' : 'false' });
      return;
    }
    const entry = this.mem.get(userKey);
    if (entry) entry.manualOffline = flag;
  }

  /**
   * 记录访客「聊天面板是否打开」——独立的 engagement 信号。
   * 按业内最佳实践，在线/离开态只由「连接 + 标签页可见 + 是否长时间无操作」决定，
   * 不随面板开关翻转；面板打开仅作为「高意向」提示传给 B 端（如「正在查看对话」），
   * 不参与 online/away 判定，也不影响离线宽限逻辑。
   */
  async setChatPanelOpen(userKey: string, open: boolean): Promise<void> {
    if (this.redis) {
      await this.redis.hSet(this.metaKey(userKey), { chatPanelOpen: open ? 'true' : 'false' });
      return;
    }
    const entry = this.mem.get(userKey);
    if (entry) entry.chatPanelOpen = open;
  }

  /** 返回某用户的「有效」状态：无在线 socket 一律离线（覆盖刷新/断线宽限）。 */
  async getPresence(userKey: string): Promise<PresenceStatus> {
    // 不再在 socket 数为 0 时强制 offline：断线宽限期内状态为 away（暂离），
    // 真正离线由 schedulePendingOffline / scanPresence 负责置为 offline。
    const meta = await this.getMeta(userKey);
    return meta?.status ?? 'offline';
  }

  async setLastSeen(userKey: string, ts: number): Promise<void> {
    if (this.redis) {
      await this.redis.hSet(this.metaKey(userKey), { lastSeen: String(ts) });
      return;
    }
    const entry = this.mem.get(userKey);
    if (entry) entry.lastSeen = ts;
  }

  async getAllSummaries(): Promise<PresenceSummary[]> {
    if (this.redis) {
      const keys = await this.redis.sMembers(this.keysSet);
      const out: PresenceSummary[] = [];
      for (const userKey of keys) {
        const meta = await this.getMeta(userKey);
        if (!meta) continue;
        const count = await this.getSocketCount(userKey);
        out.push({
          userKey,
          email: meta.email,
          userType: meta.userType,
          status: meta.status,
          lastSeen: meta.lastSeen,
          socketCount: count,
          manualOffline: meta.manualOffline,
          chatPanelOpen: meta.chatPanelOpen,
        });
      }
      return out;
    }
    return Array.from(this.mem.entries()).map(([userKey, e]) => ({
      userKey,
      email: e.email,
      userType: e.userType,
      status: e.status,
      lastSeen: e.lastSeen,
      socketCount: e.sockets.size,
      manualOffline: e.manualOffline ?? false,
      chatPanelOpen: e.chatPanelOpen ?? false,
    }));
  }

  async getAgentSummaries(): Promise<PresenceSummary[]> {
    const all = await this.getAllSummaries();
    return all.filter((s) => s.userType === 'agent');
  }
}
