import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { lookupGeo } from '../analytics/utils/geo-ip';
import { parseUserAgent } from '../analytics/utils/ua-parser';
import { maskIp, parseReferrerHost } from '../common/utils/client-ip';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';

/** 单条消息附件（返回给前端的归一化结构，url 由 S3 key 现拼） */
export interface ChatAttachmentItem {
  id: string;
  key: string;
  fileName: string;
  contentType: string;
  size: number;
  url: string;
}

export interface ChatRoomMessage {
  messageId: string;
  content: string;
  sender: 'client' | 'agent' | 'system';
  senderEmail?: string;
  timestamp: Date | string;
  isRead: boolean;
  attachments?: ChatAttachmentItem[];
  readBy: Array<{
    userEmail: string;
    userType: 'client' | 'agent';
    readAt: Date | string;
  }>;
}

/**
 * 附件上传限制（业内最佳实践）：
 * - 类型白名单（图片 / PDF / Office / 文本 / 压缩包）
 * - 单文件上限 25MB
 * 可通过环境变量覆盖，避免硬编码。
 */
const ALLOWED_ATTACHMENT_TYPES = (
  process.env.CHAT_ATTACHMENT_TYPES ||
  'image/,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,application/zip,application/x-zip-compressed'
)
  .split(',')
  .map((s) => s.trim());

const MAX_ATTACHMENT_SIZE = Number(process.env.CHAT_ATTACHMENT_MAX_SIZE ?? 25 * 1024 * 1024);
/** 预签名上传 URL 有效期（秒） */
const PRESIGN_EXPIRES_IN = 900;
/** 待发送上传占位过期时间（毫秒），超时由定时任务回收 S3 对象 */
const PENDING_UPLOAD_TTL_MS = 60 * 60 * 1000;
/** 已关闭会话的附件保留天数，到期由定时任务清理 */
const ATTACHMENT_RETENTION_DAYS = Number(process.env.CHAT_ATTACHMENT_RETENTION_DAYS ?? 365);

export interface ChatRoomResult {
  id: string;
  roomId: string;
  clientEmail: string;
  clientName?: string | null;
  status: string;
  assignedAgentEmail?: string | null;
  messages: ChatRoomMessage[];
  lastActivity: Date | string;
  closedAt?: Date | string | null;
  closedBy?: string | null;
  tags: string[];
  notes?: string | null;
  unreadCountForClient: number;
  unreadCountForAgent: number;
  lastReadByClient?: Date | string | null;
  lastReadByAgent?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  /** 本次发送是否因「访客回复已关闭会话」而触发了重开（仅 client 发送回 closed 房间时为 true） */
  reopened?: boolean;
}

/** 列表用的「最后一条消息」预览（不含完整消息体） */
export interface ChatRoomLastMessage {
  messageId: string;
  content: string | null;
  sender: 'client' | 'agent';
  senderEmail?: string | null;
  timestamp: Date | string;
  attachmentCount: number;
}

/** 列表项：不含完整 messages，改用 lastMessage 预览 + messageCount（P0 性能根因修复） */
export interface ChatRoomListItem {
  id: string;
  roomId: string;
  clientEmail: string;
  clientName?: string | null;
  status: string;
  assignedAgentEmail?: string | null;
  lastActivity: Date | string;
  closedAt?: Date | string | null;
  closedBy?: string | null;
  archivedAt?: Date | string | null;
  unreadCountForClient: number;
  unreadCountForAgent: number;
  lastReadByClient?: Date | string | null;
  lastReadByAgent?: Date | string | null;
  tags: string[];
  notes?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  messageCount: number;
  lastMessage: ChatRoomLastMessage | null;
  // 访客画像（列表轻量展示用）
  ipMasked?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  deviceType?: string | null;
  browser?: string | null;
  os?: string | null;
  referrerHost?: string | null;
  source?: string | null;
  landingPath?: string | null;
  /** 访客当前在线状态（由网关注入，列表展示实时圆点） */
  clientPresence?: 'online' | 'away' | 'offline';
  /** 已转化客户 ID（坐席将访客转为客户线索后写入） */
  customerId?: string | null;
}

/** 游标：编码 (lastActivity, id)，用于基于最后活跃时间的 keyset 分页 */
const CURSOR_SEP = '|';
function encodeCursor(room: { lastActivity: Date | string; id: string }): string {
  const iso = new Date(room.lastActivity).toISOString();
  return Buffer.from(`${iso}${CURSOR_SEP}${room.id}`).toString('base64');
}
function decodeCursor(cursor: string): { lastActivity: Date; id: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64').toString('utf8');
    const idx = raw.lastIndexOf(CURSOR_SEP);
    if (idx < 0) return null;
    const iso = raw.slice(0, idx);
    const id = raw.slice(idx + 1);
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()) || !id) return null;
    return { lastActivity: d, id };
  } catch {
    return null;
  }
}

const ROOM_WITH_MESSAGES = {
  messages: {
    include: {
      readReceipts: {
        select: { userEmail: true, userType: true, readAt: true },
        orderBy: { readAt: 'asc' as const },
      },
      attachments: {
        select: {
          id: true,
          key: true,
          fileName: true,
          contentType: true,
          size: true,
        },
        orderBy: { createdAt: 'asc' as const },
      },
    },
    orderBy: { timestamp: 'asc' as const },
  },
} as const;

function mapAttachments(raw: any[], s3: S3Service): ChatAttachmentItem[] {
  return (raw ?? []).map((a: any) => ({
    id: a.id,
    key: a.key,
    fileName: a.fileName,
    contentType: a.contentType,
    size: a.size,
    url: s3.getUrl(a.key),
  }));
}

@Injectable()
export class ChatRoomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  private mapRoom(raw: any): ChatRoomResult {
    return {
      ...raw,
      messages: (raw.messages ?? []).map((m: any) => ({
        messageId: m.messageId,
        content: m.content,
        sender: m.sender,
        senderEmail: m.senderEmail,
        timestamp: m.timestamp,
        isRead: m.isRead,
        attachments: mapAttachments(m.attachments, this.s3),
        readBy: (m.readReceipts ?? []).map((r: any) => ({
          userEmail: r.userEmail,
          userType: r.userType,
          readAt: r.readAt,
        })),
      })),
    };
  }

  /** 列表项映射：仅含最后一条消息预览 + 消息总数，绝不携带完整消息体 */
  private mapRoomSlim(raw: any): ChatRoomListItem {
    const last = raw.messages?.[0] ?? null;
    return {
      id: raw.id,
      roomId: raw.roomId,
      clientEmail: raw.clientEmail,
      clientName: raw.clientName,
      status: raw.status,
      assignedAgentEmail: raw.assignedAgentEmail,
      lastActivity: raw.lastActivity,
      closedAt: raw.closedAt,
      closedBy: raw.closedBy,
      archivedAt: raw.archivedAt,
      unreadCountForClient: raw.unreadCountForClient,
      unreadCountForAgent: raw.unreadCountForAgent,
      lastReadByClient: raw.lastReadByClient,
      lastReadByAgent: raw.lastReadByAgent,
      tags: raw.tags ?? [],
      notes: raw.notes,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      messageCount: raw._count?.messages ?? 0,
      lastMessage: last
        ? {
            messageId: last.messageId,
            content: last.content,
            sender: last.sender,
            senderEmail: last.senderEmail,
            timestamp: last.timestamp,
            attachmentCount: last._count?.attachments ?? 0,
          }
        : null,
      ipMasked: raw.ipMasked,
      country: raw.country,
      region: raw.region,
      city: raw.city,
      deviceType: raw.deviceType,
      browser: raw.browser,
      os: raw.os,
      referrerHost: raw.referrerHost,
      source: raw.source,
      landingPath: raw.landingPath,
      customerId: raw.customerId,
    };
  }

  /* ==================== 附件上传（预签名直传） ==================== */

  /**
   * 校验附件类型与大小（服务端白名单，防止任意文件上传）。
   */
  private validateAttachment(contentType: string, size: number): void {
    const allowed = ALLOWED_ATTACHMENT_TYPES.some((t) =>
      t.endsWith('/') ? contentType.startsWith(t) : contentType === t,
    );
    if (!allowed) {
      throw new BadRequestException(`不支持的文件类型: ${contentType}`);
    }
    if (!Number.isFinite(size) || size <= 0) {
      throw new BadRequestException('文件大小无效');
    }
    if (size > MAX_ATTACHMENT_SIZE) {
      throw new BadRequestException(
        `文件过大，单文件上限 ${Math.round(MAX_ATTACHMENT_SIZE / 1024 / 1024)}MB`,
      );
    }
  }

  /**
   * 生成聊天附件的预签名上传 URL（浏览器直传 S3/OSS，减轻 API 带宽压力）。
   * - 校验房间存在且请求者为参与者（client 或 assigned agent）
   * - 校验类型 / 大小
   * - 写入 ChatPendingUpload 占位（用于发送时落库 + 孤儿回收）
   */
  async presignAttachment(dto: {
    roomId: string;
    fileName: string;
    contentType: string;
    size: number;
    senderEmail: string;
  }): Promise<{ key: string; uploadUrl: string; publicUrl: string; expiresIn: number }> {
    const room = await this.prisma.chatRoom.findUnique({
      where: { roomId: dto.roomId },
    });
    if (!room) {
      throw new NotFoundException(`Chat room with ID ${dto.roomId} not found`);
    }

    const isClient = dto.senderEmail === room.clientEmail;
    const isAgent = !!room.assignedAgentEmail && dto.senderEmail === room.assignedAgentEmail;
    if (!isClient && !isAgent) {
      throw new BadRequestException('无权向该会话上传附件');
    }

    this.validateAttachment(dto.contentType, dto.size);

    const key = this.s3.buildChatKey(dto.roomId, dto.fileName);
    const uploadUrl = await this.s3.getPresignedPutUrl(key, dto.contentType, PRESIGN_EXPIRES_IN);
    const publicUrl = this.s3.getUrl(key);

    await this.prisma.chatPendingUpload.create({
      data: {
        roomId: dto.roomId,
        senderEmail: dto.senderEmail,
        key,
        fileName: dto.fileName,
        contentType: dto.contentType,
        size: dto.size,
        expiresAt: new Date(Date.now() + PENDING_UPLOAD_TTL_MS),
      },
    });

    return { key, uploadUrl, publicUrl, expiresIn: PRESIGN_EXPIRES_IN };
  }

  /**
   * 发送消息时，把已上传的 pending 占位转为正式附件并落库。
   * 仅认领属于「本房间 + 本发送者 + 未过期」的 key，其余忽略（防伪造 / 越权）。
   */
  private async attachPendingToMessage(
    messageId: string,
    keys: string[],
    senderEmail: string,
  ): Promise<void> {
    if (!keys.length) return;
    const pendings = await this.prisma.chatPendingUpload.findMany({
      where: { key: { in: keys }, senderEmail, expiresAt: { gt: new Date() } },
    });
    if (pendings.length === 0) return;

    await this.prisma.chatAttachment.createMany({
      data: pendings.map((p) => ({
        chatMessageId: messageId,
        key: p.key,
        fileName: p.fileName,
        contentType: p.contentType,
        size: p.size,
      })),
    });
    await this.prisma.chatPendingUpload.deleteMany({
      where: { key: { in: pendings.map((p) => p.key) } },
    });
  }

  /** 已关闭且超过保留期的会话，批量回收其附件（S3 对象 + 库记录）。 */
  async cleanupRetainedAttachments(): Promise<number> {
    const cutoff = new Date(Date.now() - ATTACHMENT_RETENTION_DAYS * 86_400_000);
    const rooms = await this.prisma.chatRoom.findMany({
      where: { status: 'closed', closedAt: { lt: cutoff } },
      select: { id: true },
    });
    if (rooms.length === 0) return 0;

    const attachments = await this.prisma.chatAttachment.findMany({
      where: { message: { chatRoomId: { in: rooms.map((r) => r.id) } } },
      select: { id: true, key: true },
    });
    for (const a of attachments) {
      await this.s3.delete(a.key).catch(() => undefined);
    }
    if (attachments.length > 0) {
      await this.prisma.chatAttachment.deleteMany({
        where: { id: { in: attachments.map((a) => a.id) } },
      });
    }
    return attachments.length;
  }

  private generateRoomId(): string {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 4).toUpperCase();
    return `ROOM-${timestamp}${random}`;
  }

  private generateMessageId(): string {
    return `MSG-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /* ==================== 创建 ==================== */

  async createChatRoom(dto: {
    clientEmail: string;
    clientName?: string;
    initialMessage?: string;
    clientIp?: string;
    userAgent?: string;
    referrer?: string;
    landingPath?: string;
    source?: string;
  }): Promise<ChatRoomResult> {
    // 1. 自动关闭该访客已有的 active/waiting 会话（避免僵尸 live 会话）
    const existingActive = await this.prisma.chatRoom.findMany({
      where: {
        clientEmail: dto.clientEmail,
        status: { in: ['active', 'waiting'] },
        deletedAt: null,
      },
      select: { roomId: true },
    });
    for (const old of existingActive) {
      await this.closeChatRoom(old.roomId, 'system', '访客开启了新会话').catch(() => {});
    }

    const roomId = this.generateRoomId();

    // 访客画像 enrichment：复用 analytics 既有能力（IP 地理 / UA 设备 / referrer 来源）。
    // 原始 IP 仅服务端留存，对外只暴露脱敏后的 ipMasked，符合隐私最小化。
    const ip = dto.clientIp;
    const ua = dto.userAgent;
    const parsedUa = parseUserAgent(ua);
    const geo = lookupGeo(ip);
    const referrerHost = parseReferrerHost(dto.referrer);

    const data: any = {
      roomId,
      clientEmail: dto.clientEmail,
      clientName: dto.clientName,
      status: 'waiting',
      lastActivity: new Date(),
      clientIp: ip ?? null,
      ipMasked: ip ? maskIp(ip) : null,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      deviceType: parsedUa.deviceType,
      browser: parsedUa.browser,
      os: parsedUa.os,
      referrer: dto.referrer ?? null,
      referrerHost,
      userAgent: ua ? ua.slice(0, 512) : null,
      landingPath: dto.landingPath ?? null,
      source: dto.source ?? null,
    };

    if (dto.initialMessage) {
      data.messages = {
        create: [
          {
            messageId: this.generateMessageId(),
            content: dto.initialMessage,
            sender: 'client',
            senderEmail: dto.clientEmail,
            timestamp: new Date(),
            isRead: false,
          },
        ],
      };
    }

    const room = await this.prisma.chatRoom.create({
      data,
      include: ROOM_WITH_MESSAGES,
    });
    return this.mapRoom(room);
  }

  /* ==================== 查询单个 ==================== */

  async getChatRoomById(roomId: string): Promise<ChatRoomResult> {
    const room = await this.prisma.chatRoom.findUnique({
      where: { roomId },
      include: ROOM_WITH_MESSAGES,
    });
    if (!room) {
      throw new NotFoundException(`Chat room with ID ${roomId} not found`);
    }
    return this.mapRoom(room);
  }

  async getChatRoomByClientEmail(clientEmail: string): Promise<ChatRoomResult | null> {
    const room = await this.prisma.chatRoom.findFirst({
      where: {
        clientEmail,
        status: { in: ['active', 'waiting'] },
      },
      orderBy: { lastActivity: 'desc' },
      include: ROOM_WITH_MESSAGES,
    });
    return room ? this.mapRoom(room) : null;
  }

  async getMostRecentChatRoomByClientEmail(clientEmail: string): Promise<ChatRoomResult | null> {
    const room = await this.prisma.chatRoom.findFirst({
      where: { clientEmail },
      orderBy: { lastActivity: 'desc' },
      include: ROOM_WITH_MESSAGES,
    });
    return room ? this.mapRoom(room) : null;
  }

  async canClientCreateNewRoom(clientEmail: string): Promise<boolean> {
    const activeRoom = await this.getChatRoomByClientEmail(clientEmail);
    return !activeRoom;
  }

  async getAllChatRoomsForClient(clientEmail: string): Promise<ChatRoomResult[]> {
    const rooms = await this.prisma.chatRoom.findMany({
      where: { clientEmail },
      orderBy: { lastActivity: 'desc' },
      include: ROOM_WITH_MESSAGES,
    });
    return rooms.map((r) => this.mapRoom(r));
  }

  /* ==================== 列表查询 ==================== */

  /**
   * 会话列表（轻量）：不含完整消息体，仅返回最后一条消息预览 + 消息总数，
   * 并采用基于 (lastActivity, id) 的 keyset 游标分页（P0 / P1）。
   * 完整消息仅在访客端/客服端「打开会话」时由 getChatRoomById 单独拉取。
   */
  async getChatRooms(filters: {
    status?: string;
    clientEmail?: string;
    assignedAgentEmail?: string;
    search?: string;
    cursor?: string;
    take?: number;
  }): Promise<{ rooms: ChatRoomListItem[]; nextCursor: string | null }> {
    const take = Math.min(Math.max(filters.take ?? 20, 1), 100);
    const statuses = filters.status
      ? filters.status
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

    const base: any = { deletedAt: null };
    if (statuses && statuses.length) base.status = { in: statuses };
    if (filters.clientEmail) base.clientEmail = filters.clientEmail;
    if (filters.assignedAgentEmail) base.assignedAgentEmail = filters.assignedAgentEmail;
    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim();
      base.OR = [{ clientName: { contains: q } }, { clientEmail: { contains: q } }];
    }

    let where: any = base;
    if (filters.cursor) {
      const decoded = decodeCursor(filters.cursor);
      if (decoded) {
        where = {
          AND: [
            base,
            {
              OR: [
                { lastActivity: { lt: decoded.lastActivity } },
                {
                  lastActivity: decoded.lastActivity,
                  id: { lt: decoded.id },
                },
              ],
            },
          ],
        };
      }
    }

    const rows = await this.prisma.chatRoom.findMany({
      where,
      orderBy: [{ lastActivity: 'desc' }, { id: 'desc' }],
      take: take + 1,
      include: {
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
          include: { _count: { select: { attachments: true } } },
        },
        _count: { select: { messages: true } },
      },
    });

    const hasMore = rows.length > take;
    const pageRows = hasMore ? rows.slice(0, take) : rows;
    const lastRow = pageRows.length ? pageRows[pageRows.length - 1] : undefined;
    const nextCursor = hasMore && lastRow ? encodeCursor(lastRow) : null;

    return {
      rooms: pageRows.map((r) => this.mapRoomSlim(r)),
      nextCursor,
    };
  }

  /* ==================== 发送消息 ==================== */

  async sendMessage(
    roomId: string,
    dto: {
      content?: string;
      sender: 'client' | 'agent';
      senderEmail?: string;
      attachments?: string[];
    },
  ): Promise<ChatRoomResult> {
    const room = await this.prisma.chatRoom.findUnique({ where: { roomId } });
    if (!room) {
      throw new NotFoundException(`Chat room with ID ${roomId} not found`);
    }

    const isClosed = room.status === 'closed';
    const isClientSender = dto.sender === 'client';

    // 关闭即终态：坐席不能向已关闭会话追加消息（须走显式「重新打开」动作，
    // 当前由前端引导坐席走「重新咨询」；后续可加显式重开按钮）。
    // 但访客在已关闭会话中发送消息 = 行业惯例的「回复即重开」：
    // 同一会话回到进行中（保留原负责人则延续原坐席上下文，否则回到待领取队列），
    // 使 Intercom / Zendesk 式的「客户回复使已解决会话重新打开」生效，
    // 而非静默失败，也不是只能另开新会话。
    if (isClosed && !isClientSender) {
      throw new BadRequestException('Cannot send message to closed chat room');
    }

    const reopened = isClosed && isClientSender;

    if (!dto.content && !dto.attachments?.length) {
      throw new BadRequestException('消息内容或附件至少提供一项');
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        messageId: this.generateMessageId(),
        content: dto.content,
        sender: dto.sender,
        senderEmail: dto.senderEmail,
        chatRoomId: room.id,
        timestamp: new Date(),
        isRead: false,
      },
    });

    if (dto.attachments?.length) {
      await this.attachPendingToMessage(
        message.id,
        dto.attachments,
        dto.senderEmail ?? room.clientEmail,
      );
    }

    const updateData: any = {
      lastActivity: new Date(),
    };

    if (dto.sender === 'client') {
      updateData.unreadCountForAgent = { increment: 1 };
      if (reopened) {
        // 重开：原会话有负责人 → 恢复为 active（延续上下文）；
        // 无负责人 → 回到 waiting 队列等待坐席领取。同时清空 closedAt。
        updateData.status = room.assignedAgentEmail ? 'active' : 'waiting';
        updateData.closedAt = null;
      }
    } else if (dto.sender === 'agent') {
      updateData.unreadCountForClient = { increment: 1 };
      if (room.status === 'waiting') {
        updateData.status = 'active';
        if (dto.senderEmail) {
          updateData.assignedAgentEmail = dto.senderEmail;
        }
      }
    }

    await this.prisma.chatRoom.update({
      where: { roomId },
      data: updateData,
    });

    const result = await this.getChatRoomById(roomId);
    return { ...result, reopened };
  }

  /* ==================== 已读 ==================== */

  async markMessagesAsReadByUser(
    roomId: string,
    userEmail: string,
    userType: 'client' | 'agent',
    messageIds?: string[],
  ): Promise<ChatRoomResult> {
    const room = await this.prisma.chatRoom.findUnique({
      where: { roomId },
      include: {
        messages: {
          include: { readReceipts: true },
        },
      },
    });
    if (!room) {
      throw new NotFoundException(`Chat room with ID ${roomId} not found`);
    }

    const oppositeSender = userType === 'client' ? 'agent' : 'client';
    let updatedCount = 0;

    for (const msg of room.messages) {
      const shouldMark = messageIds
        ? messageIds.includes(msg.messageId)
        : msg.sender === oppositeSender && !msg.readReceipts.some((r) => r.userEmail === userEmail);

      if (shouldMark) {
        if (!msg.readReceipts.some((r) => r.userEmail === userEmail)) {
          await this.prisma.messageReadReceipt.create({
            data: {
              messageId: msg.id,
              userEmail,
              userType,
              readAt: new Date(),
            },
          });
          updatedCount++;
        }

        const hasOtherSide = msg.readReceipts.some((r) => r.userType !== userType);
        if (hasOtherSide) {
          await this.prisma.chatMessage.update({
            where: { id: msg.id },
            data: { isRead: true },
          });
        }
      }
    }

    const updateData: any = {};
    if (userType === 'client') {
      updateData.unreadCountForClient = Math.max(
        0,
        (room.unreadCountForClient || 0) - updatedCount,
      );
      updateData.lastReadByClient = new Date();
    } else {
      updateData.unreadCountForAgent = Math.max(0, (room.unreadCountForAgent || 0) - updatedCount);
      updateData.lastReadByAgent = new Date();
    }

    await this.prisma.chatRoom.update({
      where: { roomId },
      data: updateData,
    });

    return this.getChatRoomById(roomId);
  }

  async getUnreadCountForUser(
    roomId: string,
    userEmail: string,
    userType: 'client' | 'agent',
  ): Promise<number> {
    const oppositeSender = userType === 'client' ? 'agent' : 'client';
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        room: { roomId },
        sender: oppositeSender,
      },
      include: { readReceipts: true },
    });

    return messages.filter((m) => !m.readReceipts.some((r) => r.userEmail === userEmail)).length;
  }

  /* ==================== 通知计数 ==================== */

  async getNotificationCounts(
    userEmail?: string,
    userType?: 'client' | 'agent',
  ): Promise<{
    totalUnread: number;
    roomCounts: Array<{
      roomId: string;
      unreadCount: number;
      clientEmail: string;
      status: string;
    }>;
  }> {
    const rooms = await this.prisma.chatRoom.findMany({
      select: {
        roomId: true,
        clientEmail: true,
        status: true,
        unreadCountForAgent: true,
        unreadCountForClient: true,
      },
    });

    let totalUnread = 0;
    const roomCounts: Array<{
      roomId: string;
      unreadCount: number;
      clientEmail: string;
      status: string;
    }> = [];

    for (const room of rooms) {
      let unread = 0;
      if (userType === 'agent') {
        unread = room.unreadCountForAgent;
      } else if (userType === 'client' && room.clientEmail === userEmail) {
        unread = room.unreadCountForClient;
      }
      if (unread > 0) {
        roomCounts.push({
          roomId: room.roomId,
          unreadCount: unread,
          clientEmail: room.clientEmail,
          status: room.status,
        });
        totalUnread += unread;
      }
    }

    return { totalUnread, roomCounts };
  }

  async resetNotificationCount(roomId: string, userType: 'client' | 'agent'): Promise<void> {
    const data: any =
      userType === 'client'
        ? { unreadCountForClient: 0, lastReadByClient: new Date() }
        : { unreadCountForAgent: 0, lastReadByAgent: new Date() };

    await this.prisma.chatRoom.update({ where: { roomId }, data });
  }

  /* ==================== 更新 & 删除 ==================== */

  async updateChatRoom(
    roomId: string,
    dto: {
      status?: string;
      assignedAgentEmail?: string;
      notes?: string;
      tags?: string[];
    },
  ): Promise<ChatRoomResult> {
    const room = await this.prisma.chatRoom.findUnique({ where: { roomId } });
    if (!room) {
      throw new NotFoundException(`Chat room with ID ${roomId} not found`);
    }

    const data: any = { lastActivity: new Date() };
    if (dto.status) {
      data.status = dto.status;
      if (dto.status === 'closed') data.closedAt = new Date();
    }
    if (dto.assignedAgentEmail !== undefined) data.assignedAgentEmail = dto.assignedAgentEmail;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.tags !== undefined) data.tags = dto.tags;

    await this.prisma.chatRoom.update({ where: { roomId }, data });
    return this.getChatRoomById(roomId);
  }

  /**
   * 关闭会话（幂等）：
   * - 状态置 closed + 记录 closedAt / closedBy
   * - 写入一条系统消息说明关闭原因
   * - 若已关闭/归档则直接返回
   */
  async closeChatRoom(roomId: string, closedBy: string, reason?: string): Promise<ChatRoomResult> {
    const room = await this.prisma.chatRoom.findUnique({ where: { roomId } });
    if (!room) {
      throw new NotFoundException(`Chat room with ID ${roomId} not found`);
    }
    if (room.status === 'closed' || room.status === 'archived') {
      return this.getChatRoomById(roomId); // 幂等
    }

    const systemMessage = reason ?? '会话已关闭';
    const messageId = this.generateMessageId();

    await this.prisma.chatRoom.update({
      where: { roomId },
      data: {
        status: 'closed',
        closedAt: new Date(),
        closedBy,
        lastActivity: new Date(),
        messages: {
          create: {
            messageId,
            content: systemMessage,
            sender: 'system',
            senderEmail: closedBy,
            timestamp: new Date(),
            isRead: true,
          },
        },
      },
    });
    return this.getChatRoomById(roomId);
  }

  async getUnreadMessageCount(agentEmail?: string): Promise<number> {
    const where: any = {
      room: { status: { in: ['active', 'waiting'] } },
      sender: 'client',
      isRead: false,
    };
    if (agentEmail) {
      where.room.assignedAgentEmail = agentEmail;
    }
    return this.prisma.chatMessage.count({ where });
  }

  /* ==================== 统计 ==================== */

  async getChatRoomStats(): Promise<{
    totalRooms: number;
    statusBreakdown: {
      active: number;
      waiting: number;
      closed: number;
      archived: number;
    };
    totalMessages: number;
  }> {
    const nonDeleted = { deletedAt: null };
    const [totalRooms, active, waiting, closed, archived, totalMessages] = await Promise.all([
      this.prisma.chatRoom.count({ where: nonDeleted }),
      this.prisma.chatRoom.count({ where: { ...nonDeleted, status: 'active' } }),
      this.prisma.chatRoom.count({ where: { ...nonDeleted, status: 'waiting' } }),
      this.prisma.chatRoom.count({ where: { ...nonDeleted, status: 'closed' } }),
      this.prisma.chatRoom.count({ where: { ...nonDeleted, status: 'archived' } }),
      this.prisma.chatMessage.count(),
    ]);

    return {
      totalRooms,
      statusBreakdown: { active, waiting, closed, archived },
      totalMessages,
    };
  }

  /* ==================== 自动归档 / 批量运维 ==================== */

  /**
   * 定时维护（由网关 @Interval 调用）：
   *  1) 闲置 waiting 会话（超过 CHAT_IDLE_CLOSE_HOURS 无活动）→ 自动关闭
   *  2) 已关闭超过 CHAT_ARCHIVE_AFTER_DAYS 的会话 → 自动归档
   * 返回实际变更条数，便于日志/监控。
   */
  async autoMaintain(): Promise<{ closed: number; archived: number }> {
    const now = Date.now();
    const idleCloseMs = Number(process.env.CHAT_IDLE_CLOSE_HOURS ?? 24) * 3_600_000;
    const archiveMs = Number(process.env.CHAT_ARCHIVE_AFTER_DAYS ?? 30) * 86_400_000;

    const closedRes = await this.prisma.chatRoom.updateMany({
      where: {
        status: 'waiting',
        deletedAt: null,
        lastActivity: { lt: new Date(now - idleCloseMs) },
      },
      data: { status: 'closed', closedAt: new Date() },
    });

    const archivedRes = await this.prisma.chatRoom.updateMany({
      where: {
        status: 'closed',
        deletedAt: null,
        closedAt: { lt: new Date(now - archiveMs) },
      },
      data: { status: 'archived', archivedAt: new Date() },
    });

    return { closed: closedRes.count, archived: archivedRes.count };
  }

  /** 批量软删除（仅打标，列表过滤；物理删除走独立清理任务） */
  async softDeleteRooms(roomIds: string[]): Promise<number> {
    if (roomIds.length === 0) return 0;
    const res = await this.prisma.chatRoom.updateMany({
      where: { roomId: { in: roomIds }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return res.count;
  }

  /** 批量设置状态（关闭 / 归档），用于列表多选后的批量操作 */
  async batchSetStatus(roomIds: string[], status: 'closed' | 'archived'): Promise<number> {
    if (roomIds.length === 0) return 0;
    const data: any = { status, lastActivity: new Date() };
    if (status === 'closed') data.closedAt = new Date();
    if (status === 'archived') data.archivedAt = new Date();
    const res = await this.prisma.chatRoom.updateMany({
      where: { roomId: { in: roomIds }, deletedAt: null },
      data,
    });
    return res.count;
  }

  /* ==================== 删除 ==================== */

  async deleteChatRoom(roomId: string): Promise<void> {
    try {
      await this.prisma.chatRoom.delete({ where: { roomId } });
    } catch {
      throw new NotFoundException(`Chat room with ID ${roomId} not found`);
    }
  }
}
