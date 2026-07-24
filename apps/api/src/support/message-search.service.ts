import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { PrismaService } from '../prisma/prisma.service';

/** 单条消息命中（会话聚合：每个会话取相关度最高的一条） */
export interface MessageSearchHit {
  /** ChatRoom.id（内部主键，非 roomId 业务码） */
  roomId: string;
  messageId: string;
  content: string;
  timestamp: Date;
  sender: string;
}

/**
 * 消息全文检索抽象（阶段二接缝）。
 *
 * 现阶段由 {@link PgTrgmMessageSearchService} 用 PostgreSQL pg_trgm 实现，零新增基础设施。
 * 未来数据量 / 相关性要求上升时，只需新增一个 MeiliMessageSearchService 实现并在
 * support.module.ts 中替换 `useClass`，getChatRooms / 前端交互均无需改动。
 */
export abstract class MessageSearchService {
  /**
   * 按关键词检索包含匹配消息的会话，返回「每会话最相关一条」命中，按相关度 + 时间降序。
   * @param query 用户输入的原始关键词
   * @param opts.limit 最多返回的会话命中数（默认 50）
   */
  abstract searchRooms(query: string, opts?: { limit?: number }): Promise<MessageSearchHit[]>;
}

/** 过短关键词对 trigram 索引意义不大且噪声高，低于此长度不做正文检索 */
const MIN_QUERY_LENGTH = 2;
const DEFAULT_LIMIT = 50;

/** 转义 LIKE/ILIKE 通配符，避免用户输入的 % _ \ 被当作模式元字符 */
function toLikePattern(query: string): string {
  const escaped = query.replace(/[\\%_]/g, (c) => `\\${c}`);
  return `%${escaped}%`;
}

type RawHit = {
  roomId: string;
  messageId: string;
  content: string;
  timestamp: Date;
  sender: string;
};

/**
 * PostgreSQL pg_trgm 实现：
 * - `ILIKE '%q%'` 走 chat_messages_content_trgm_idx（GIN + gin_trgm_ops）索引；
 * - `similarity()` 提供相关度排序（trigram 相似度）；
 * - DISTINCT ON 折叠为「每会话最相关一条」，再按相关度 + 时间取前 N 个会话。
 * 仅检索未软删除会话（deletedAt IS NULL），状态 / 权限过滤由上层 getChatRooms 复用其 where 复合完成。
 *
 * 检索索引（pg_trgm 扩展 + GIN 索引）已由 Prisma schema 声明并随 0_init 迁移创建，
 * 无需运行期自建；受限托管库如缺 DDL 权限，可由 DBA 预置或走 `make db-index` / prisma:index:search。
 */
@Injectable()
export class PgTrgmMessageSearchService extends MessageSearchService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async searchRooms(query: string, opts?: { limit?: number }): Promise<MessageSearchHit[]> {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) return [];
    const limit = Math.min(Math.max(opts?.limit ?? DEFAULT_LIMIT, 1), 200);
    const pattern = toLikePattern(q);

    const rows = await this.prisma.$queryRaw<RawHit[]>(Prisma.sql`
      SELECT sub."roomId", sub."messageId", sub.content, sub."timestamp", sub.sender
      FROM (
        SELECT DISTINCT ON (m."chatRoomId")
          m."chatRoomId" AS "roomId",
          m."messageId"  AS "messageId",
          m.content      AS content,
          m."timestamp"  AS "timestamp",
          m.sender       AS sender,
          similarity(m.content, ${q}) AS sim
        FROM chat_messages m
        JOIN chat_rooms r ON r.id = m."chatRoomId"
        WHERE r."deletedAt" IS NULL
          AND m.content IS NOT NULL
          AND m.content ILIKE ${pattern}
        ORDER BY m."chatRoomId", similarity(m.content, ${q}) DESC, m."timestamp" DESC
      ) sub
      ORDER BY sub.sim DESC, sub."timestamp" DESC
      LIMIT ${limit}
    `);

    return rows.map((r) => ({
      roomId: r.roomId,
      messageId: r.messageId,
      content: r.content,
      timestamp: r.timestamp,
      sender: r.sender,
    }));
  }
}
