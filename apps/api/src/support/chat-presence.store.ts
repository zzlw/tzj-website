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
      entry = { email, userType, status: 'offline', lastSeen: Date.now(), sockets: new Set() };
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
  } | null> {
    if (this.redis) {
      const raw = await this.redis.hGetAll(this.metaKey(userKey));
      if (!raw || !raw.email) return null;
      return {
        email: raw.email,
        userType: (raw.userType as 'client' | 'agent') ?? 'client',
        status: (raw.status as PresenceStatus) ?? 'offline',
        lastSeen: raw.lastSeen ? Number(raw.lastSeen) : 0,
      };
    }
    const entry = this.mem.get(userKey);
    if (!entry) return null;
    return {
      email: entry.email,
      userType: entry.userType,
      status: entry.status,
      lastSeen: entry.lastSeen,
    };
  }

  /** 返回某用户的「有效」状态：无在线 socket 一律离线（覆盖刷新/断线宽限）。 */
  async getPresence(userKey: string): Promise<PresenceStatus> {
    const count = await this.getSocketCount(userKey);
    if (count <= 0) return 'offline';
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
          status: count > 0 ? meta.status : 'offline',
          lastSeen: meta.lastSeen,
          socketCount: count,
        });
      }
      return out;
    }
    return Array.from(this.mem.entries()).map(([userKey, e]) => ({
      userKey,
      email: e.email,
      userType: e.userType,
      status: e.sockets.size > 0 ? e.status : 'offline',
      lastSeen: e.lastSeen,
      socketCount: e.sockets.size,
    }));
  }

  async getAgentSummaries(): Promise<PresenceSummary[]> {
    const all = await this.getAllSummaries();
    return all.filter((s) => s.userType === 'agent');
  }
}
