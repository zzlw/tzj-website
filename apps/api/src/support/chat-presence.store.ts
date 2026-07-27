import { Injectable } from '@nestjs/common';

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

/**
 * 在线状态存储（纯内存实现）。
 *
 * 适用于单实例部署（≤100 用户规模）。socket 成员用 Set 管理。
 */
@Injectable()
export class ChatPresenceStore {
  private readonly mem = new Map<
    string,
    {
      email: string;
      userType: 'client' | 'agent';
      status: PresenceStatus;
      lastSeen: number;
      sockets: Set<string>;
      manualOffline: boolean;
      chatPanelOpen: boolean;
    }
  >();

  async addSocket(
    userKey: string,
    email: string,
    userType: 'client' | 'agent',
    socketId: string,
  ): Promise<number> {
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
    const entry = this.mem.get(userKey);
    if (!entry) return 0;
    entry.sockets.delete(socketId);
    return entry.sockets.size;
  }

  /** 心跳/活跃时续命（内存模式下无需额外操作）。 */
  async refreshSocket(_userKey: string, _socketId: string): Promise<void> {
    // 内存模式无 TTL，空实现
  }

  async getSocketCount(userKey: string): Promise<number> {
    return this.mem.get(userKey)?.sockets.size ?? 0;
  }

  async setStatus(userKey: string, status: PresenceStatus, lastSeen = Date.now()): Promise<void> {
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
    const entry = this.mem.get(userKey);
    if (entry) entry.chatPanelOpen = open;
  }

  /** 返回某用户的「有效」状态。 */
  async getPresence(userKey: string): Promise<PresenceStatus> {
    const meta = await this.getMeta(userKey);
    return meta?.status ?? 'offline';
  }

  async setLastSeen(userKey: string, ts: number): Promise<void> {
    const entry = this.mem.get(userKey);
    if (entry) entry.lastSeen = ts;
  }

  async getAllSummaries(): Promise<PresenceSummary[]> {
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
