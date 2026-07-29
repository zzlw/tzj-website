/**
 * Notification counts 统计口径回归测试（设计 docs/chat-unread-notification-design.md §7）
 *
 * 覆盖：
 * - §4.1.1 未读拆桶：myUnread / unassignedUnread / othersUnread，
 *   且 totalUnread = myUnread + unassignedUnread（口径收窄，他人会话不进主徽标）
 * - 已关闭/归档会话不计入任何桶（既有行为回归）
 * - §4.1.3 client 分支输出与改造前逐字段一致（严格快照）
 * - §4.1.4 handleJoinRoom client 分支：访客入房后在线坐席 socket 均被拉入该房间
 */
import 'reflect-metadata';
import { ChatGateway } from './chat.gateway';
import { ChatRoomService } from './chat-room.service';

type FakeRoom = {
  roomId: string;
  status: string;
  deletedAt: Date | null;
  clientEmail: string;
  assignedAgentEmail: string | null;
};

type FakeReceipt = { userEmail: string; userType: 'client' | 'agent' };

type FakeMessage = {
  roomId: string;
  sender: 'client' | 'agent';
  readReceipts: FakeReceipt[];
};

function makeRoom(overrides: Partial<FakeRoom> & { roomId: string }): FakeRoom {
  return {
    roomId: overrides.roomId,
    status: overrides.status ?? 'waiting',
    deletedAt: overrides.deletedAt ?? null,
    clientEmail: overrides.clientEmail ?? 'test@example.com',
    assignedAgentEmail: overrides.assignedAgentEmail ?? null,
  };
}

/**
 * fake prisma：精确模拟 getNotificationCounts 使用的带过滤关系计数
 * （select._count.select.messages.where：sender + readReceipts.none 条件）。
 */
function buildService(rooms: FakeRoom[]) {
  const store = new Map(rooms.map((r) => [r.roomId, { ...r }]));
  const messages: FakeMessage[] = [];

  const countUnread = (
    roomId: string,
    msgWhere: {
      sender: string;
      readReceipts?: { none: { userEmail?: string; userType?: string } };
    },
  ): number => {
    return messages.filter((m) => {
      if (m.roomId !== roomId) return false;
      if (m.sender !== msgWhere.sender) return false;
      const none = msgWhere.readReceipts?.none;
      if (none) {
        // Prisma `none`：不存在满足条件的回执才计入未读
        const hasReceipt = m.readReceipts.some(
          (rr) =>
            (none.userEmail === undefined || rr.userEmail === none.userEmail) &&
            (none.userType === undefined || rr.userType === none.userType),
        );
        if (hasReceipt) return false;
      }
      return true;
    }).length;
  };

  // biome-ignore lint/suspicious/noExplicitAny: 测试用 fake prisma
  const prisma: any = {
    chatRoom: {
      // biome-ignore lint/suspicious/noExplicitAny: 测试用 fake prisma
      findMany: async ({ where, select }: any) => {
        const filtered = [...store.values()].filter((r) => {
          if (where?.deletedAt === null && r.deletedAt !== null) return false;
          if (where?.status?.in && !where.status.in.includes(r.status)) return false;
          return true;
        });
        const msgWhere = select?._count?.select?.messages?.where;
        return filtered.map((r) => ({
          roomId: r.roomId,
          clientEmail: r.clientEmail,
          status: r.status,
          assignedAgentEmail: r.assignedAgentEmail,
          _count: { messages: msgWhere ? countUnread(r.roomId, msgWhere) : 0 },
        }));
      },
    },
  };

  // biome-ignore lint/suspicious/noExplicitAny: 依赖桩
  const stub: any = {};
  const service = new ChatRoomService(prisma, stub, stub, stub, stub, stub);
  return {
    service,
    addMessage: (roomId: string, sender: 'client' | 'agent', receipts: FakeReceipt[] = []) => {
      messages.push({ roomId, sender, readReceipts: receipts });
    },
  };
}

describe('getNotificationCounts', () => {
  describe('Agent 分支（§4.1.1 按归属人分桶 + 口径收窄）', () => {
    it('三桶各有未读：验证四个计数字段与 roomCounts 的 assignedAgentEmail', async () => {
      const rooms = [
        makeRoom({
          roomId: 'R1',
          status: 'active',
          clientEmail: 'c1@test.com',
          assignedAgentEmail: 'agent-a@test.com',
        }),
        makeRoom({
          roomId: 'R2',
          status: 'active',
          clientEmail: 'c2@test.com',
          assignedAgentEmail: 'agent-b@test.com',
        }),
        makeRoom({ roomId: 'R3', status: 'waiting', clientEmail: 'c3@test.com' }),
      ];
      const { service, addMessage } = buildService(rooms);

      // R1：3 条客户消息，其中 1 条已被坐席读过（agent 桶按 userType 键控回执）
      addMessage('R1', 'client', [{ userEmail: 'agent-a@test.com', userType: 'agent' }]);
      addMessage('R1', 'client');
      addMessage('R1', 'client');
      addMessage('R1', 'client');
      // R2：2 条（agent-a 视角的 othersUnread）
      addMessage('R2', 'client');
      addMessage('R2', 'client');
      // R3：2 条（unassignedUnread）
      addMessage('R3', 'client');
      addMessage('R3', 'client');

      const result = await service.getNotificationCounts('agent-a@test.com', 'agent');

      expect(result.myUnread).toBe(3);
      expect(result.unassignedUnread).toBe(2);
      expect(result.othersUnread).toBe(2);
      // §4.1.1 收窄：totalUnread = myUnread + unassignedUnread，othersUnread 不进主徽标
      expect(result.totalUnread).toBe(5);
      const byRoom = new Map(result.roomCounts.map((rc) => [rc.roomId, rc]));
      expect(byRoom.get('R1')?.assignedAgentEmail).toBe('agent-a@test.com');
      expect(byRoom.get('R1')?.unreadCount).toBe(3);
      expect(byRoom.get('R2')?.assignedAgentEmail).toBe('agent-b@test.com');
      expect(byRoom.get('R3')?.assignedAgentEmail).toBeNull();
    });

    it('unassignedUnread：未分配会话计入待认领桶', async () => {
      const rooms = [
        makeRoom({
          roomId: 'R1',
          status: 'active',
          clientEmail: 'c1@test.com',
          assignedAgentEmail: 'agent-a@test.com',
        }),
        makeRoom({ roomId: 'R2', status: 'waiting', clientEmail: 'c2@test.com' }),
        makeRoom({
          roomId: 'R3',
          status: 'waiting',
          clientEmail: 'c3@test.com',
          assignedAgentEmail: 'agent-b@test.com',
        }),
      ];
      const { service, addMessage } = buildService(rooms);

      addMessage('R1', 'client');
      addMessage('R2', 'client');
      addMessage('R2', 'client');
      addMessage('R3', 'client');

      const result = await service.getNotificationCounts('agent-a@test.com', 'agent');

      // R2（waiting 未分配）→ unassignedUnread；R3（waiting 但已分配他人）→ othersUnread
      expect(result.unassignedUnread).toBe(2);
      expect(result.myUnread).toBe(1); // R1
      expect(result.othersUnread).toBe(1); // R3
      expect(result.totalUnread).toBe(3); // my(1) + unassigned(2)
    });

    it('othersUnread：分配给他人的会话不计入 myUnread，也不进 totalUnread', async () => {
      const rooms = [
        makeRoom({
          roomId: 'R1',
          status: 'active',
          clientEmail: 'c1@test.com',
          assignedAgentEmail: 'agent-b@test.com',
        }),
        makeRoom({
          roomId: 'R2',
          status: 'active',
          clientEmail: 'c2@test.com',
          assignedAgentEmail: 'agent-a@test.com',
        }),
      ];
      const { service, addMessage } = buildService(rooms);

      addMessage('R1', 'client');
      addMessage('R1', 'client');
      addMessage('R2', 'client');

      const result = await service.getNotificationCounts('agent-a@test.com', 'agent');

      expect(result.myUnread).toBe(1); // 仅 R2
      expect(result.othersUnread).toBe(2); // R1
      expect(result.totalUnread).toBe(1); // §4.1.1：仅 my + unassigned(0)
      // roomCounts 仍返回他人房间（供列表弱化展示）
      expect(result.roomCounts.map((rc) => rc.roomId).sort()).toEqual(['R1', 'R2']);
    });

    it('不统计 closed/archived 会话（既有行为回归）', async () => {
      const rooms = [
        makeRoom({
          roomId: 'R1',
          status: 'closed',
          clientEmail: 'c1@test.com',
          assignedAgentEmail: 'agent-a@test.com',
        }),
        makeRoom({
          roomId: 'R2',
          status: 'archived',
          clientEmail: 'c2@test.com',
          assignedAgentEmail: 'agent-a@test.com',
        }),
        makeRoom({ roomId: 'R3', status: 'waiting', clientEmail: 'c3@test.com' }),
        makeRoom({
          roomId: 'R4',
          status: 'active',
          clientEmail: 'c4@test.com',
          assignedAgentEmail: 'agent-a@test.com',
        }),
      ];
      const { service, addMessage } = buildService(rooms);

      addMessage('R1', 'client'); // closed：应忽略
      addMessage('R2', 'client'); // archived：应忽略
      addMessage('R3', 'client');
      addMessage('R4', 'client');

      const result = await service.getNotificationCounts('agent-a@test.com', 'agent');

      expect(result.totalUnread).toBe(2); // my(R4)=1 + unassigned(R3)=1
      expect(result.unassignedUnread).toBe(1);
      expect(result.myUnread).toBe(1);
      expect(result.othersUnread).toBe(0);
      expect(result.roomCounts.map((rc) => rc.roomId).sort()).toEqual(['R3', 'R4']);
    });
  });

  describe('Client 分支（§4.1.3 输出与改造前逐字段一致）', () => {
    it('仅统计 clientEmail === userEmail 的会话，不含三桶扩展字段（严格快照）', async () => {
      const rooms = [
        makeRoom({
          roomId: 'R1',
          status: 'active',
          clientEmail: 'alice@test.com',
          assignedAgentEmail: 'agent-a@test.com',
        }),
        makeRoom({
          roomId: 'R2',
          status: 'active',
          clientEmail: 'bob@test.com',
          assignedAgentEmail: 'agent-b@test.com',
        }),
      ];
      const { service, addMessage } = buildService(rooms);

      addMessage('R1', 'agent');
      addMessage('R1', 'agent');
      addMessage('R2', 'agent');
      // alice 已读过的一条不计入（client 回执按 userEmail + userType 匹配）
      addMessage('R1', 'agent', [{ userEmail: 'alice@test.com', userType: 'client' }]);

      const result = await service.getNotificationCounts('alice@test.com', 'client');

      // 严格快照：他人房间不进 total 也不进 roomCounts，且无 my/unassigned/others 字段
      expect(result).toEqual({
        totalUnread: 2,
        roomCounts: [
          { roomId: 'R1', unreadCount: 2, clientEmail: 'alice@test.com', status: 'active' },
        ],
      });
    });
  });

  describe('edge cases', () => {
    it('deletedAt 非空的会话不计入', async () => {
      const rooms = [
        makeRoom({
          roomId: 'R1',
          status: 'active',
          clientEmail: 'c1@test.com',
          assignedAgentEmail: 'agent-a@test.com',
          deletedAt: new Date(),
        }),
        makeRoom({
          roomId: 'R2',
          status: 'active',
          clientEmail: 'c2@test.com',
          assignedAgentEmail: 'agent-a@test.com',
        }),
      ];
      const { service, addMessage } = buildService(rooms);

      addMessage('R1', 'client'); // 已删除：应忽略
      addMessage('R2', 'client');

      const result = await service.getNotificationCounts('agent-a@test.com', 'agent');

      expect(result.totalUnread).toBe(1);
    });

    it('已读回执（userType 键控）正确消减坐席未读数', async () => {
      const rooms = [
        makeRoom({
          roomId: 'R1',
          status: 'active',
          clientEmail: 'c1@test.com',
          assignedAgentEmail: 'agent-a@test.com',
        }),
      ];
      const { service, addMessage } = buildService(rooms);

      addMessage('R1', 'client');
      addMessage('R1', 'client');
      addMessage('R1', 'client');

      const result1 = await service.getNotificationCounts('agent-a@test.com', 'agent');
      expect(result1.totalUnread).toBe(3);

      // 任一坐席读过即消减（agent 桶按 userType 匹配，任意坐席回执均生效）
      const { service: service2, addMessage: addMessage2 } = buildService(rooms);
      addMessage2('R1', 'client', [{ userEmail: 'agent-a@test.com', userType: 'agent' }]);
      addMessage2('R1', 'client', [{ userEmail: 'agent-b@test.com', userType: 'agent' }]);
      addMessage2('R1', 'client');

      const result2 = await service2.getNotificationCounts('agent-a@test.com', 'agent');
      expect(result2.totalUnread).toBe(1); // 仅剩 1 条未读
    });
  });
});

describe('ChatGateway.handleJoinRoom（§4.1.4 访客入房拉入在线坐席）', () => {
  // biome-ignore lint/suspicious/noExplicitAny: 测试用假 socket
  function makeSocket(email: string, type: 'agent' | 'client'): any {
    return {
      id: `sock-${email}`,
      data: { auth: { email, type } },
      join: jest.fn(async () => {}),
      to: () => ({ emit: jest.fn() }),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };
  }

  function makeGateway(room: Record<string, unknown>) {
    // biome-ignore lint/suspicious/noExplicitAny: 依赖桩
    const chatRoomService: any = {
      getChatRoomById: jest.fn(async () => room),
      updateChatRoom: jest.fn(async () => room),
    };
    // biome-ignore lint/suspicious/noExplicitAny: 依赖桩
    const presence: any = { getPresence: jest.fn(async () => 'online') };
    // biome-ignore lint/suspicious/noExplicitAny: 绕过私有属性访问限制
    const gateway: any = new ChatGateway(
      chatRoomService,
      // biome-ignore lint/suspicious/noExplicitAny: 依赖桩
      {} as any,
      presence,
      // biome-ignore lint/suspicious/noExplicitAny: 依赖桩
      null as any,
    );
    return gateway;
  }

  it('client join-room：全部在线坐席 socket 被拉入房间，其他访客不拉入', async () => {
    const roomId = 'ROOM-1';
    const gateway = makeGateway({
      roomId,
      status: 'active',
      clientEmail: 'alice@test.com',
      assignedAgentEmail: 'agent-a@test.com',
    });

    const clientSock = makeSocket('alice@test.com', 'client');
    const agentSock1 = makeSocket('agent-a@test.com', 'agent');
    const agentSock2 = makeSocket('agent-b@test.com', 'agent');
    const otherClientSock = makeSocket('bob@test.com', 'client');
    gateway.server = {
      fetchSockets: jest.fn(async () => [clientSock, agentSock1, agentSock2, otherClientSock]),
      to: () => ({ emit: jest.fn() }),
      emit: jest.fn(),
    };

    await gateway.handleJoinRoom(clientSock, { roomId });

    expect(clientSock.join).toHaveBeenCalledWith(roomId);
    expect(agentSock1.join).toHaveBeenCalledWith(roomId);
    expect(agentSock2.join).toHaveBeenCalledWith(roomId);
    expect(otherClientSock.join).not.toHaveBeenCalledWith(roomId);
  });

  it('agent join-room：不触发 fetchSockets 拉人', async () => {
    const roomId = 'ROOM-2';
    const gateway = makeGateway({
      roomId,
      status: 'active',
      clientEmail: 'alice@test.com',
      assignedAgentEmail: 'agent-b@test.com',
    });

    const agentSock = makeSocket('agent-a@test.com', 'agent');
    const fetchSockets = jest.fn(async () => []);
    gateway.server = {
      fetchSockets,
      to: () => ({ emit: jest.fn() }),
      emit: jest.fn(),
    };

    await gateway.handleJoinRoom(agentSock, { roomId });

    expect(agentSock.join).toHaveBeenCalledWith(roomId);
    expect(fetchSockets).not.toHaveBeenCalled();
  });
});
