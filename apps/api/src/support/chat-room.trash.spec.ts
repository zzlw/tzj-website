/**
 * 回收站不变量回归测试（P1-4）
 *
 * 覆盖 §5 案例复盘的五种口径，守护：
 * "回收站内必为已结束（closed/archived）会话" 这条核心不变量。
 */
import { ChatRoomService } from './chat-room.service';

// ── Mock：轻量内存 Prisma + S3 + Presence ──

type FakeRoom = {
  id: string;
  roomId: string;
  status: string;
  deletedAt: Date | null;
  clientEmail: string;
  clientName: string | null;
  assignedAgentEmail: string | null;
  customerId: string | null;
  visitorId: string | null;
  createdAt: Date;
};

function makeRoom(overrides: Partial<FakeRoom> & { roomId: string }): FakeRoom {
  return {
    id: overrides.roomId,
    roomId: overrides.roomId,
    status: overrides.status ?? 'closed',
    deletedAt: overrides.deletedAt ?? null,
    clientEmail: overrides.clientEmail ?? 'test@example.com',
    clientName: overrides.clientName ?? null,
    assignedAgentEmail: overrides.assignedAgentEmail ?? null,
    customerId: overrides.customerId ?? null,
    visitorId: overrides.visitorId ?? null,
    createdAt: overrides.createdAt ?? new Date(),
  };
}

function buildService(rooms: FakeRoom[]) {
  const store = new Map(rooms.map((r) => [r.roomId, { ...r }]));

  const prisma: any = {
    chatRoom: {
      findUnique: async ({ where }: any) => store.get(where.roomId) ?? null,
      findMany: async ({ where }: any) => {
        return [...store.values()].filter((r) => {
          if (where?.deletedAt === null && r.deletedAt !== null) return false;
          if (where?.deletedAt?.not === null && r.deletedAt === null) return false;
          if (where?.roomId?.in && !where.roomId.in.includes(r.roomId)) return false;
          if (where?.status?.in && !where.status.in.includes(r.status)) return false;
          return true;
        });
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const r of store.values()) {
          const matchRoom = !where.roomId?.in || where.roomId.in.includes(r.roomId);
          const matchDeleted = where.deletedAt === undefined || (where.deletedAt === null ? r.deletedAt === null : true);
          const matchStatus = !where.status?.in || where.status.in.includes(r.status);
          if (matchRoom && matchDeleted && matchStatus) {
            Object.assign(r, data);
            count++;
          }
        }
        return { count };
      },
      update: async ({ where, data }: any) => {
        const r = store.get(where.roomId);
        if (!r) throw new Error('not found');
        Object.assign(r, data);
        return r;
      },
      count: async ({ where }: any) => {
        return [...store.values()].filter((r) => {
          if (where?.chatRoomId && r.id !== where.chatRoomId) return false;
          return true;
        }).length;
      },
      delete: async ({ where }: any) => {
        const key = where.roomId ?? where.id;
        const r = [...store.values()].find((v) => v.roomId === key || v.id === key);
        if (!r) throw new Error('not found');
        store.delete(r.roomId);
        return r;
      },
    },
    chatMessage: { count: async () => 0 },
    chatAttachment: { findMany: async () => [] },
    chatPendingUpload: { findMany: async () => [], deleteMany: async () => ({ count: 0 }) },
    customer: { updateMany: async () => ({ count: 0 }) },
    chatRoomDeletionAudit: { create: async () => ({}) },
    auditLog: { create: async () => ({}) },
    $transaction: async (fn: any) => fn(prisma),
  };

  const s3: any = { delete: async () => {} };
  const presence: any = { getAgentSummaries: async () => [] };
  const search: any = {};
  const settings: any = {};
  const notification: any = {};

  const service = new ChatRoomService(prisma, s3, presence, search, settings, notification);
  return { service, store };
}

// ── Tests ──

describe('回收站不变量回归测试', () => {
  it('1. softDeleteRooms（批量）：仅 closed/archived 被软删', async () => {
    const rooms = [
      makeRoom({ roomId: 'R1', status: 'closed' }),
      makeRoom({ roomId: 'R2', status: 'archived' }),
      makeRoom({ roomId: 'R3', status: 'active' }),
      makeRoom({ roomId: 'R4', status: 'waiting' }),
    ];
    const { service, store } = buildService(rooms);

    const count = await service.softDeleteRooms(['R1', 'R2', 'R3', 'R4']);

    expect(count).toBe(2);
    expect(store.get('R1')!.deletedAt).not.toBeNull();
    expect(store.get('R2')!.deletedAt).not.toBeNull();
    expect(store.get('R3')!.deletedAt).toBeNull();
    expect(store.get('R4')!.deletedAt).toBeNull();
  });

  it('2. softDeleteChatRoom（单删）：active 会话被拒绝', async () => {
    const rooms = [makeRoom({ roomId: 'R1', status: 'active' })];
    const { service } = buildService(rooms);

    await expect(service.softDeleteChatRoom('R1')).rejects.toThrow();
  });

  it('2b. softDeleteChatRoom（单删）：closed 会话正常软删', async () => {
    const rooms = [makeRoom({ roomId: 'R1', status: 'closed' })];
    const { service, store } = buildService(rooms);

    const result = await service.softDeleteChatRoom('R1');

    expect(result).toEqual({ deleted: true, soft: true });
    expect(store.get('R1')!.deletedAt).not.toBeNull();
  });

  it('3. restoreChatRoom：恢复后 deletedAt=null 且 status 保持原值', async () => {
    const rooms = [makeRoom({ roomId: 'R1', status: 'closed', deletedAt: new Date() })];
    const { service, store } = buildService(rooms);

    const result = await service.restoreChatRoom('R1');

    expect(result).toEqual({ restored: true });
    expect(store.get('R1')!.deletedAt).toBeNull();
    expect(store.get('R1')!.status).toBe('closed');
  });

  it('4. purgeChatRoom：物理删除会话行', async () => {
    const rooms = [makeRoom({ roomId: 'R1', status: 'closed', deletedAt: new Date() })];
    const { service, store } = buildService(rooms);

    const result = await service.purgeChatRoom('R1', 'admin-001');

    expect(result).toEqual({ deleted: true, purged: true });
    expect(store.has('R1')).toBe(false);
  });

  it('4b. purgeChatRoom：未在回收站中的会话被拒绝', async () => {
    const rooms = [makeRoom({ roomId: 'R1', status: 'closed', deletedAt: null })];
    const { service } = buildService(rooms);

    await expect(service.purgeChatRoom('R1', 'admin-001')).rejects.toThrow();
  });

  it('5. getChatRooms(deleted:true)：仅返回 deletedAt 非空 + status∈{closed,archived}', async () => {
    const rooms = [
      makeRoom({ roomId: 'R1', status: 'closed', deletedAt: new Date() }),
      makeRoom({ roomId: 'R2', status: 'archived', deletedAt: new Date() }),
      makeRoom({ roomId: 'R3', status: 'active', deletedAt: null }),
      makeRoom({ roomId: 'R4', status: 'closed', deletedAt: null }),
    ];
    const { service } = buildService(rooms);

    const result = await service.getChatRooms({ deleted: true });

    expect(result.rooms.length).toBe(2);
    for (const room of result.rooms) {
      expect(['closed', 'archived']).toContain(room.status);
    }
  });
});
