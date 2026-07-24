import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client/index';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { IpLocationService } from '../analytics/ip-location.service';
import { lookupGeo } from '../analytics/utils/geo-ip';
import { formatGeoLabel } from '../analytics/utils/geo-label';
import { parseUserAgent } from '../analytics/utils/ua-parser';
import { maskIp, parseReferrerHost } from '../common/utils/client-ip';
import { LAST_OPERATOR_USER_SELECT, mapOperatorUser } from '../common/utils/content-list';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { PrismaService } from '../prisma/prisma.service';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { S3Service } from '../storage/s3.service';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { ChatNotificationService } from './chat-notification.service';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { ChatPresenceStore } from './chat-presence.store';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { type MessageSearchHit, MessageSearchService } from './message-search.service';

const MAX_MESSAGE_LENGTH = 4000;

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
  /** 负责人账号信息（供 B 端 hover 资料卡展示，复用 content 模块 OperatorUser 结构） */
  assignedAgentUser?: ReturnType<typeof mapOperatorUser>;
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

/** 访客站内浏览行为聚合（来自 analytics page_views，按 visitorId 归并）。 */
interface VisitorBehavior {
  pageViews: number | null;
  sessions: number | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  trafficSource: string | null;
}

/** 无关联访客 / 无浏览记录时的行为占位（各字段留空，前端据此隐藏对应区块）。 */
const EMPTY_BEHAVIOR: VisitorBehavior = {
  pageViews: null,
  sessions: null,
  firstSeenAt: null,
  lastSeenAt: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  trafficSource: null,
};

/** 取最精确地址：优先 IP 重解析结果，回退入库 GeoIP 标签；均无则 null。 */
function pickLocation(
  resolvedLocation: string | undefined | null,
  fallbackLabel: string,
): string | null {
  const precise = resolvedLocation?.trim();
  if (precise) return precise;
  return fallbackLabel && fallbackLabel !== '未知' ? fallbackLabel : null;
}

/** 定位依据：IP 重解析命中 → ip；否则有回退地址 → geoip；均无 → unknown。 */
function resolveGeoSource(
  resolvedByIp: boolean,
  location: string | null,
): 'ip' | 'geoip' | 'unknown' {
  if (resolvedByIp) return 'ip';
  if (location) return 'geoip';
  return 'unknown';
}

/**
 * 访客档案（B 端「访客信息」抽屉/弹窗）：在读取时按原始 IP 重解析归属地，
 * 并聚合该访客站内浏览行为与营销归因（口径对齐「访客分析」）。原始 IP 不外泄，仅返回脱敏 ipMasked。
 */
export interface VisitorProfileResult extends VisitorBehavior {
  ipMasked?: string | null;
  /** 读取时重解析的最精确地址（省市区/城市），失败回退入库时的 GeoIP 值 */
  location: string | null;
  /** 运营商（纯真库中文「电信/联通」等），仅 IP 解析命中时有值 */
  isp: string | null;
  /** 定位依据：ip（重解析）| geoip（入库粗定位）| unknown */
  geoSource: 'ip' | 'geoip' | 'unknown';
  deviceType?: string | null;
  deviceModel?: string | null;
  deviceVendor?: string | null;
  browser?: string | null;
  browserVersion?: string | null;
  os?: string | null;
  osVersion?: string | null;
  clientApp?: string | null;
  referrer?: string | null;
  referrerHost?: string | null;
  landingPath?: string | null;
  source?: string | null;
  visitorId?: string | null;
  /** 该访客的历史会话数（按 visitorId 优先，回退 clientEmail） */
  chatRoomCount: number;
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

/** 搜索命中的消息片段（按聊天内容搜索时回填，供列表行高亮 + 跳转定位） */
export interface ChatRoomMatchedMessage {
  messageId: string;
  content: string;
  sender: string;
  timestamp: Date | string;
}

/** 列表项：不含完整 messages，改用 lastMessage 预览 + messageCount（P0 性能根因修复） */
export interface ChatRoomListItem {
  id: string;
  roomId: string;
  clientEmail: string;
  clientName?: string | null;
  status: string;
  assignedAgentEmail?: string | null;
  /** 负责人账号信息（供 B 端 hover 资料卡展示） */
  assignedAgentUser?: ReturnType<typeof mapOperatorUser>;
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
  /** 访客是否当前打开了聊天面板（独立 engagement 信号，不影响在线态） */
  clientPanelOpen?: boolean;
  /** 已转化客户 ID（坐席将访客转为客户线索后写入） */
  customerId?: string | null;
  /** 按聊天内容搜索时命中的消息片段（仅正文命中的会话有值，供高亮 + 跳转） */
  matchedMessage?: ChatRoomMatchedMessage | null;
}

/** Prisma 返回体的结构类型（去除 any），供 mapRoom / mapRoomSlim / mapAttachments 使用 */
type RawAttachment = {
  id: string;
  key: string;
  fileName: string;
  contentType: string;
  size: number;
};

type RawReadReceipt = {
  userEmail: string;
  userType: string;
  readAt: Date | string;
};

type RawMessage = {
  messageId: string;
  content: string | null;
  sender: string;
  senderEmail?: string | null;
  timestamp: Date | string;
  isRead: boolean;
  attachments?: RawAttachment[];
  readReceipts?: RawReadReceipt[];
  _count?: { attachments: number } | null;
};

/** DB 以 String 存储发送者/用户类型，映射到领域联合类型时的桥接别名 */
type ChatMessageSender = ChatRoomMessage['sender'];
type ChatMessageUserType = ChatRoomMessage['readBy'][number]['userType'];
type ChatLastSender = ChatRoomLastMessage['sender'];

type ChatRoomScalars = {
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
  tags: string[];
  notes?: string | null;
  unreadCountForClient: number;
  unreadCountForAgent: number;
  lastReadByClient?: Date | string | null;
  lastReadByAgent?: Date | string | null;
  customerId?: string | null;
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
  createdAt: Date | string;
  updatedAt: Date | string;
};

type RawRoomFull = ChatRoomScalars & { messages: RawMessage[] };
type RawRoomSlim = ChatRoomScalars & {
  messages: RawMessage[];
  _count?: { messages: number } | null;
};

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

function mapAttachments(raw: RawAttachment[], s3: S3Service): ChatAttachmentItem[] {
  return (raw ?? []).map((a: RawAttachment) => ({
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
  private readonly logger = new Logger(ChatRoomService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly presence: ChatPresenceStore,
    private readonly chatNotify: ChatNotificationService,
    private readonly messageSearch: MessageSearchService,
    private readonly ipLocation: IpLocationService,
  ) {}

  private mapRoom(raw: RawRoomFull): ChatRoomResult {
    return {
      ...raw,
      messages: (raw.messages ?? []).map((m: RawMessage) => ({
        messageId: m.messageId,
        content: m.content ?? '',
        sender: m.sender as ChatMessageSender,
        senderEmail: m.senderEmail ?? undefined,
        timestamp: m.timestamp,
        isRead: m.isRead,
        attachments: mapAttachments(m.attachments ?? [], this.s3),
        readBy: (m.readReceipts ?? []).map((r: RawReadReceipt) => ({
          userEmail: r.userEmail,
          userType: r.userType as ChatMessageUserType,
          readAt: r.readAt,
        })),
      })),
    };
  }

  /** 列表项映射：仅含最后一条消息预览 + 消息总数，绝不携带完整消息体 */
  private mapRoomSlim(
    raw: RawRoomSlim,
    agentUserMap?: Map<string, Parameters<typeof mapOperatorUser>[0]>,
    matchedHits?: Map<string, MessageSearchHit>,
  ): ChatRoomListItem {
    const last = raw.messages?.[0] ?? null;
    const hit = matchedHits?.get(raw.id);
    return {
      id: raw.id,
      roomId: raw.roomId,
      clientEmail: raw.clientEmail,
      clientName: raw.clientName,
      status: raw.status,
      assignedAgentEmail: raw.assignedAgentEmail,
      assignedAgentUser: raw.assignedAgentEmail
        ? mapOperatorUser(agentUserMap?.get(raw.assignedAgentEmail.toLowerCase()))
        : undefined,
      lastActivity: raw.lastActivity,
      closedAt: raw.closedAt,
      closedBy: raw.closedBy,
      archivedAt: raw.archivedAt,
      unreadCountForClient: raw.unreadCountForClient,
      // 使用实时计算的未读数（从 messages + receipts 表），而非 DB 增量计数器。
      // 已关闭/归档会话视为已处理，列表不展示未读徽标（与未读总数口径一致）。
      unreadCountForAgent:
        raw.status === 'closed' || raw.status === 'archived'
          ? 0
          : (raw._count?.messages ?? raw.unreadCountForAgent),
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
            sender: last.sender as ChatLastSender,
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
      matchedMessage: hit
        ? {
            messageId: hit.messageId,
            content: hit.content,
            sender: hit.sender,
            timestamp: hit.timestamp,
          }
        : null,
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
    visitorId?: string;
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

    const data: Prisma.ChatRoomCreateInput = {
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
      deviceModel: parsedUa.deviceModel,
      deviceVendor: parsedUa.deviceVendor,
      browser: parsedUa.browser,
      browserVersion: parsedUa.browserVersion,
      os: parsedUa.os,
      osVersion: parsedUa.osVersion,
      clientApp: parsedUa.clientApp,
      referrer: dto.referrer ?? null,
      referrerHost,
      userAgent: ua ? ua.slice(0, 512) : null,
      landingPath: dto.landingPath ?? null,
      source: dto.source ?? null,
      visitorId: dto.visitorId ?? null,
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

    // 自动分配 / 路由（P1 H3）：若有在线坐席，立即把新会话派给「负载最低」的在线坐席，
    // 缩短首响、提升接起率；无人在线则保持 waiting，由离线留言通知闭环（M3）兜底。
    try {
      const assigned = await this.assignAvailableAgent(room.roomId);
      if (assigned) {
        return await this.getChatRoomById(room.roomId);
      }
    } catch (error) {
      this.logger.warn(`自动分配坐席失败 roomId=${room.roomId}: ${(error as Error).message}`);
    }

    return this.mapRoom(room);
  }

  /**
   * 选择「负载最低」的可用坐席作为路由目标（P1 H3，多坐席最佳实践增强版）。
   *
   * 策略（参考 LiveChat / Intercom / Zendesk 业内实践）：
   *  1. 优先选 status='online' 的坐席；无 online 时退而选 'away'（仍有活跃 socket，
   *     可接收通知并响应——总比无人应答强，LiveChat/Intercom 均路由给 away 坐席）。
   *  2. 过滤已达容量上限的坐席（AGENT_MAX_CONCURRENT_CHATS，默认 10）
   *  3. 在未满坐席中选负载最低者；平局随机取其一（公平性）
   *  4. 所有坐席均满或无连接 → 返回 null（会话留在 waiting 队列，待坐席空闲后接入）
   */
  async pickAvailableAgentEmail(): Promise<string | null> {
    const agents = await this.presence.getAgentSummaries();
    // 有活跃 socket 的坐席（排除 Redis 僵尸记录）：优先 online，无 online 时兜底 away
    const withSocket = agents.filter((a) => a.socketCount > 0);
    const online = withSocket.filter((a) => a.status === 'online').map((a) => a.email);
    const away = withSocket.filter((a) => a.status === 'away').map((a) => a.email);
    // 两级路由：online 优先；无 online 坐席时退而选 away（仍连接中，可即时收到通知）
    const pool = online.length > 0 ? online : away;
    if (pool.length === 0) {
      // 诊断日志：定位「未分配」根因——是无坐席记录、无活跃 socket、还是状态不对
      this.logger.warn(
        `[路由] 无可用坐席！agentSummaries=${JSON.stringify(
          agents.map((a) => ({ email: a.email, status: a.status, sockets: a.socketCount })),
        )}`,
      );
      return null;
    }

    // 坐席并发容量上限（环境变量可配，默认 10）
    const maxCapacity = Number.parseInt(process.env.AGENT_MAX_CONCURRENT_CHATS ?? '10', 10) || 10;
    // 只统计「近期活跃」的会话（默认 24h 内有活动），历史遗留的未关闭会话不计入容量。
    // 业内实践（LiveChat/Intercom）：并发上限针对的是正在进行的对话，非全部历史会话。
    const activeWindowHours =
      Number.parseInt(process.env.AGENT_ACTIVE_WINDOW_HOURS ?? '24', 10) || 24;
    const activeSince = new Date(Date.now() - activeWindowHours * 3600_000);

    const groups = await this.prisma.chatRoom.groupBy({
      by: ['assignedAgentEmail'],
      where: {
        assignedAgentEmail: { in: pool },
        status: { in: ['active', 'waiting'] },
        deletedAt: null,
        lastActivity: { gte: activeSince },
      },
      _count: { _all: true },
    });
    const load = new Map<string, number>(
      groups
        .filter(
          (g): g is { assignedAgentEmail: string; _count: { _all: number } } =>
            !!g.assignedAgentEmail,
        )
        .map((g) => [g.assignedAgentEmail, g._count._all] as [string, number]),
    );

    // 过滤已达容量上限的坐席
    const eligible = pool.filter((email) => (load.get(email) ?? 0) < maxCapacity);
    if (eligible.length === 0) {
      this.logger.warn(
        `所有可用坐席均已达到容量上限(${maxCapacity})，会话将留在 waiting 队列。` +
          ` 负载: ${pool.map((e) => `${e}=${load.get(e) ?? 0}`).join(', ')}，活跃窗口: ${activeWindowHours}h`,
      );
      return null;
    }

    // 在未满坐席中选负载最低者；平局随机取其一（公平性）
    let bestLoad = Number.POSITIVE_INFINITY;
    for (const email of eligible) {
      const loadN = load.get(email) ?? 0;
      if (loadN < bestLoad) bestLoad = loadN;
    }
    const candidates = eligible.filter((email) => (load.get(email) ?? 0) === bestLoad);
    const picked = candidates[Math.floor(Math.random() * candidates.length)] ?? null;

    if (picked) {
      this.logger.log(
        `路由分配: ${picked} (load=${bestLoad}/${maxCapacity}, eligible=${eligible.length}/${pool.length}, tier=${online.length > 0 ? 'online' : 'away-fallback'})`,
      );
    }
    return picked;
  }

  /** 把会话分配给负载最低的可用坐席（优先 online，兜底 away），返回被指派的坐席邮箱（无可用坐席返回 null）。 */
  async assignAvailableAgent(roomId: string): Promise<string | null> {
    const target = await this.pickAvailableAgentEmail();
    if (!target) return null;
    await this.updateChatRoom(roomId, { status: 'active', assignedAgentEmail: target });
    return target;
  }

  /**
   * 获取坐席花名册详情（nickname + 活跃会话数），供转接 UI 展示。
   * 业内最佳实践（Zendesk/Intercom）：转接列表显示坐席姓名 + 当前工作量，辅助决策。
   * 仅返回系统中真实存在的用户（按 email 或 username 匹配），过滤测试探针连接。
   */
  async getAgentRosterDetails(
    emails: string[],
  ): Promise<Map<string, { name: string | null; activeRoomCount: number }>> {
    if (emails.length === 0) return new Map();
    const [users, groups] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          isActive: true,
          OR: [{ email: { in: emails } }, { username: { in: emails } }],
        },
        select: { email: true, nickname: true, username: true },
      }),
      this.prisma.chatRoom.groupBy({
        by: ['assignedAgentEmail'],
        where: {
          assignedAgentEmail: { in: emails },
          status: { in: ['active', 'waiting'] },
          deletedAt: null,
        },
        _count: { _all: true },
      }),
    ]);
    // 构建 email/username → 显示名 映射（一个用户可能通过 email 或 username 连接）
    const nameMap = new Map<string, string | null>();
    for (const u of users) {
      const name = u.nickname || u.username || null;
      if (u.email) nameMap.set(u.email, name);
      nameMap.set(u.username, name);
    }
    const countMap = new Map(
      groups
        .filter(
          (g): g is { assignedAgentEmail: string; _count: { _all: number } } =>
            !!g.assignedAgentEmail,
        )
        .map((g) => [g.assignedAgentEmail, g._count._all] as [string, number]),
    );
    // 仅保留在 User 表中存在的坐席（过滤测试/探针连接）
    const result = new Map<string, { name: string | null; activeRoomCount: number }>();
    for (const email of emails) {
      if (!nameMap.has(email)) continue; // 非系统用户，跳过
      result.set(email, {
        name: nameMap.get(email) ?? null,
        activeRoomCount: countMap.get(email) ?? 0,
      });
    }
    return result;
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
    const result = this.mapRoom(room);
    // 附带负责人账号信息（B 端 ChatHeader hover 资料卡用）
    if (room.assignedAgentEmail) {
      const agentUser = await this.prisma.user.findFirst({
        where: {
          OR: [{ email: room.assignedAgentEmail }, { username: room.assignedAgentEmail }],
        },
        select: LAST_OPERATOR_USER_SELECT,
      });
      result.assignedAgentUser = mapOperatorUser(agentUser) ?? undefined;
    }
    return result;
  }

  /**
   * 访客档案（B 端「访客信息」）：对齐「访客分析」的数据与「依据 IP 取位置」原理。
   * - 地区在读取时按原始 IP 重解析（IpLocationService：纯真库 + 在线补充），历史会话也能到省市区 + 运营商；
   *   解析失败回退入库时的 GeoIP 粗定位。原始 IP 不外泄，仅返回脱敏 ipMasked。
   * - 会话关联分析访客（visitorId）时，聚合其站内 PV/UV/会话数/首末访问/营销归因。
   */
  async getVisitorProfile(roomId: string): Promise<VisitorProfileResult> {
    const room = await this.prisma.chatRoom.findUnique({
      where: { roomId },
      select: {
        clientEmail: true,
        clientIp: true,
        ipMasked: true,
        country: true,
        region: true,
        city: true,
        deviceType: true,
        deviceModel: true,
        deviceVendor: true,
        browser: true,
        browserVersion: true,
        os: true,
        osVersion: true,
        clientApp: true,
        referrer: true,
        referrerHost: true,
        landingPath: true,
        source: true,
        visitorId: true,
      },
    });
    if (!room) {
      throw new NotFoundException(`Chat room with ID ${roomId} not found`);
    }

    const resolved = await this.ipLocation.resolve(room.clientIp);
    const fallback = formatGeoLabel({
      country: room.country,
      region: room.region,
      city: room.city,
    });
    const location = pickLocation(resolved?.location, fallback);
    const geoSource = resolveGeoSource(Boolean(resolved), location);

    const behavior = room.visitorId
      ? await this.aggregateVisitorBehavior(room.visitorId)
      : EMPTY_BEHAVIOR;
    const chatRoomCount = await this.prisma.chatRoom.count({
      where: room.visitorId
        ? { visitorId: room.visitorId, deletedAt: null }
        : { clientEmail: room.clientEmail, deletedAt: null },
    });

    return {
      ...behavior,
      ipMasked: room.ipMasked,
      location,
      isp: resolved?.isp?.trim() ? resolved.isp.trim() : null,
      geoSource,
      deviceType: room.deviceType,
      deviceModel: room.deviceModel,
      deviceVendor: room.deviceVendor,
      browser: room.browser,
      browserVersion: room.browserVersion,
      os: room.os,
      osVersion: room.osVersion,
      clientApp: room.clientApp,
      referrer: room.referrer,
      referrerHost: room.referrerHost,
      landingPath: room.landingPath,
      source: room.source,
      visitorId: room.visitorId,
      chatRoomCount,
    };
  }

  /** 聚合分析访客的站内浏览行为与首触营销归因（单条 $queryRaw，剔除 bot）。 */
  private async aggregateVisitorBehavior(visitorId: string): Promise<VisitorBehavior> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        pageViews: bigint;
        sessions: bigint;
        firstSeenAt: Date | null;
        lastSeenAt: Date | null;
        utmSource: string | null;
        utmMedium: string | null;
        utmCampaign: string | null;
        trafficSource: string | null;
      }>
    >`
      SELECT
        COUNT(*)::bigint AS "pageViews",
        COUNT(DISTINCT "sessionId")::bigint AS sessions,
        MIN("createdAt") AS "firstSeenAt",
        MAX("createdAt") AS "lastSeenAt",
        (ARRAY_AGG("utmSource" ORDER BY "createdAt" DESC) FILTER (WHERE "utmSource" IS NOT NULL))[1] AS "utmSource",
        (ARRAY_AGG("utmMedium" ORDER BY "createdAt" DESC) FILTER (WHERE "utmMedium" IS NOT NULL))[1] AS "utmMedium",
        (ARRAY_AGG("utmCampaign" ORDER BY "createdAt" DESC) FILTER (WHERE "utmCampaign" IS NOT NULL))[1] AS "utmCampaign",
        (ARRAY_AGG("trafficSource" ORDER BY "createdAt" DESC) FILTER (WHERE "trafficSource" IS NOT NULL))[1] AS "trafficSource"
      FROM "page_views"
      WHERE "visitorId" = ${visitorId} AND "isBot" = false
    `;
    const row = rows[0];
    if (!row || Number(row.pageViews) === 0) return EMPTY_BEHAVIOR;
    return {
      pageViews: Number(row.pageViews),
      sessions: Number(row.sessions),
      firstSeenAt: row.firstSeenAt ? row.firstSeenAt.toISOString() : null,
      lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
      utmSource: row.utmSource,
      utmMedium: row.utmMedium,
      utmCampaign: row.utmCampaign,
      trafficSource: row.trafficSource,
    };
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
    visitorId?: string;
  }): Promise<{ rooms: ChatRoomListItem[]; nextCursor: string | null }> {
    const take = Math.min(Math.max(filters.take ?? 20, 1), 100);
    const statuses = filters.status
      ? filters.status
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

    const base: Prisma.ChatRoomWhereInput = { deletedAt: null };
    if (statuses && statuses.length) base.status = { in: statuses };
    if (filters.clientEmail) base.clientEmail = filters.clientEmail;
    if (filters.assignedAgentEmail) base.assignedAgentEmail = filters.assignedAgentEmail;
    if (filters.visitorId) base.visitorId = filters.visitorId;
    // 搜索：访客名 / 邮箱（元数据）+ 聊天正文（pg_trgm）。正文命中的会话经 MessageSearchService
    // 折叠为「每会话最相关一条」，其 id 并入 base.OR；命中片段回填到列表行（高亮 + 跳转）。
    // 状态 / deletedAt 过滤由外层 where 复合完成，正文命中不绕过权限与桶过滤。
    let matchedHits: Map<string, MessageSearchHit> | undefined;
    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim();
      const orClauses: Prisma.ChatRoomWhereInput[] = [
        { clientName: { contains: q } },
        { clientEmail: { contains: q } },
      ];
      const hits = await this.messageSearch.searchRooms(q, { limit: 200 });
      if (hits.length) {
        matchedHits = new Map(hits.map((h) => [h.roomId, h]));
        orClauses.push({ id: { in: [...matchedHits.keys()] } });
      }
      base.OR = orClauses;
    }

    let where: Prisma.ChatRoomWhereInput = base;
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
        _count: {
          select: {
            // 实时计算 agent 未读数：client 发的消息中没有 agent 回执的条数
            // 同时作为 messageCount（列表展示用，不影响业务逻辑）
            messages: {
              where: {
                sender: 'client',
                readReceipts: {
                  none: { userType: 'agent' },
                },
              },
            },
          },
        },
      },
    });

    const hasMore = rows.length > take;
    const pageRows = hasMore ? rows.slice(0, take) : rows;
    const lastRow = pageRows.length ? pageRows[pageRows.length - 1] : undefined;
    const nextCursor = hasMore && lastRow ? encodeCursor(lastRow) : null;

    // 批量查询负责人账号信息（B 端 hover 资料卡用），单次 IN 查询避免 N+1。
    // 坐席以 username=邮箱 登录，User.email 可能为空，须 OR 双字段匹配
    // （同 getAgentRosterDetails 的查找策略）。
    const agentEmails = [
      ...new Set(pageRows.map((r) => r.assignedAgentEmail).filter((e): e is string => !!e)),
    ];
    const agentUsers = agentEmails.length
      ? await this.prisma.user.findMany({
          where: {
            OR: [{ email: { in: agentEmails } }, { username: { in: agentEmails } }],
          },
          select: LAST_OPERATOR_USER_SELECT,
        })
      : [];
    // email 和 username 均作键，确保 assignedAgentEmail 无论命中哪个字段都能找到
    const agentUserMap = new Map<string, (typeof agentUsers)[number]>();
    for (const u of agentUsers) {
      if (u.email) agentUserMap.set(u.email.toLowerCase(), u);
      agentUserMap.set(u.username.toLowerCase(), u);
    }

    return {
      rooms: pageRows.map((r) => this.mapRoomSlim(r, agentUserMap, matchedHits)),
      nextCursor,
    };
  }

  /* ==================== 发送消息 ==================== */

  async sendMessage(
    roomId: string,
    dto: {
      content?: string;
      sender: 'client' | 'agent' | 'system';
      senderEmail?: string;
      attachments?: string[];
    },
  ): Promise<ChatRoomResult> {
    const room = await this.prisma.chatRoom.findUnique({ where: { roomId } });
    if (!room) {
      throw new NotFoundException(`Chat room with ID ${roomId} not found`);
    }

    // 长度校验（P2 M2）：服务端硬性上限，杜绝超长消息导致的存储/渲染问题。
    if (dto.content && dto.content.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(`消息过长，单条上限 ${MAX_MESSAGE_LENGTH} 字`);
    }

    // 归属校验（P0 C2，REST 兜底路径）：访客只能以「房间持有者」身份发送，
    // 防止未鉴权的 REST 调用冒用他人会话。
    if (dto.sender === 'client' && dto.senderEmail !== room.clientEmail) {
      throw new BadRequestException('无权以该身份发送消息');
    }

    const isClosed = room.status === 'closed';
    const isArchived = room.status === 'archived';
    const isClientSender = dto.sender === 'client';
    const isSystemSender = dto.sender === 'system';

    // 归档即冷存终态（业内最佳实践 Zendesk/LiveChat/Freshchat）：归档会话是封存的历史快照，
    // 访客新消息应「开启新会话」而非原地重开（归档语境已陈旧、原坐席上下文失效）。
    // 服务端拒绝向归档会话发消息（可识别错误码 ROOM_ARCHIVED），杜绝消息石沉大海；
    // C 端恢复流程检测到归档会话时清空本地存储、引导访客自然开启新对话。
    // 系统消息不受此限制（内部流转兜底）。
    if (isArchived && !isSystemSender) {
      throw new BadRequestException({ code: 'ROOM_ARCHIVED', message: '会话已归档，请开启新对话' });
    }

    // 关闭即终态：坐席不能向已关闭会话追加消息（须走显式「重新打开」动作，
    // 当前由前端引导坐席走「重新咨询」；后续可加显式重开按钮）。
    // 但访客在已关闭会话中发送消息 = 行业惯例的「回复即重开」：
    // 同一会话回到进行中（保留原负责人则延续原坐席上下文，否则回到待领取队列），
    // 使 Intercom / Zendesk 式的「客户回复使已解决会话重新打开」生效，
    // 而非静默失败，也不是只能另开新会话。
    // 系统消息（转接/分配/关闭通知）不受此限制。
    if (isClosed && !isClientSender && !isSystemSender) {
      throw new BadRequestException('Cannot send message to closed chat room');
    }

    const reopened = isClosed && isClientSender;

    if (reopened) {
      // 「回复即重开」场景下，先把重开前已存在的未读客户消息标记为坐席已读，
      // 仅保留本次客户端新消息为未读，避免关闭期间积压的旧未读随重开一起冒红点。
      await this.markMessagesAsReadByUser(
        roomId,
        room.assignedAgentEmail ?? 'agent',
        'agent',
      ).catch(() => {});
    }

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

    const updateData: Prisma.ChatRoomUpdateInput = {
      lastActivity: new Date(),
    };

    // 系统消息（转接/分配等）不触发状态变更和未读计数
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

    // 离线留言 → 坐席通知闭环（P2 M3）：访客在「无坐席在线」的会话留言时主动提醒。
    if (dto.sender === 'client') {
      try {
        const agents = await this.presence.getAgentSummaries();
        const anyOnline = agents.some((a) => a.socketCount > 0 && a.status === 'online');
        if (!anyOnline) {
          void this.chatNotify.notifyOfflineMessage(roomId, room.clientEmail);
        }
      } catch (error) {
        this.logger.warn(`离线留言通知失败 roomId=${roomId}: ${(error as Error).message}`);
      }
    }

    return { ...result, reopened };
  }

  /* ==================== 已读 ==================== */

  async markMessagesAsReadByUser(
    roomId: string,
    userEmail: string,
    userType: 'client' | 'agent',
    messageIds?: string[],
  ): Promise<ChatRoomResult & { markedMessageIds: string[] }> {
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

    // 归属校验（P0 C2，REST 兖底路径）：访客只能操作自己的会话。
    if (userType === 'client' && userEmail !== room.clientEmail) {
      throw new BadRequestException('无权操作该会话');
    }

    const oppositeSender = userType === 'client' ? 'agent' : 'client';
    const now = new Date();
    // 收集需要创建回执的消息 ID（内部 DB id）和公开 messageId
    const receiptCreates: Array<{
      messageId: string;
      userEmail: string;
      userType: 'client' | 'agent';
      readAt: Date;
    }> = [];
    const markedMessageIds: string[] = [];
    // 双方都已读的消息 ID，需更新 isRead=true
    const bothReadMessageIds: string[] = [];

    for (const msg of room.messages) {
      const shouldMark = messageIds
        ? messageIds.includes(msg.messageId)
        : msg.sender === oppositeSender && !msg.readReceipts.some((r) => r.userEmail === userEmail);

      if (shouldMark && !msg.readReceipts.some((r) => r.userEmail === userEmail)) {
        receiptCreates.push({ messageId: msg.id, userEmail, userType, readAt: now });
        markedMessageIds.push(msg.messageId);
        // 对方已有回执 → 双方均已读，标记 isRead
        if (msg.readReceipts.some((r) => r.userType !== userType)) {
          bothReadMessageIds.push(msg.id);
        }
      }
    }

    // 批量创建回执（单次 DB 写入，替代逐条 create，大幅降低延迟）
    if (receiptCreates.length > 0) {
      await this.prisma.messageReadReceipt.createMany({
        data: receiptCreates,
        skipDuplicates: true,
      });
    }
    // 批量更新双方已读标记
    if (bothReadMessageIds.length > 0) {
      await this.prisma.chatMessage.updateMany({
        where: { id: { in: bothReadMessageIds } },
        data: { isRead: true },
      });
    }

    const updatedCount = receiptCreates.length;
    const updateData: Prisma.ChatRoomUpdateInput = {};
    if (userType === 'client') {
      if (updatedCount > 0) {
        updateData.unreadCountForClient = { decrement: updatedCount };
      }
      updateData.lastReadByClient = now;
    } else {
      if (updatedCount > 0) {
        updateData.unreadCountForAgent = { decrement: updatedCount };
      }
      updateData.lastReadByAgent = now;
    }

    const updatedRoom = await this.prisma.chatRoom.update({
      where: { roomId },
      data: updateData,
    });

    // 轻量返回：网关仅需 roomId / unreadCounts / lastRead 字段，无需加载全量消息，
    // 避免昂贵的 getChatRoomById 查询（包含所有消息 + 所有回执）。
    return {
      id: updatedRoom.id,
      roomId: updatedRoom.roomId,
      clientEmail: updatedRoom.clientEmail,
      clientName: updatedRoom.clientName,
      status: updatedRoom.status,
      assignedAgentEmail: updatedRoom.assignedAgentEmail,
      messages: [],
      lastActivity: updatedRoom.lastActivity,
      closedAt: updatedRoom.closedAt,
      closedBy: updatedRoom.closedBy,
      tags: updatedRoom.tags ?? [],
      notes: updatedRoom.notes,
      unreadCountForClient: Math.max(0, updatedRoom.unreadCountForClient),
      unreadCountForAgent: Math.max(0, updatedRoom.unreadCountForAgent),
      lastReadByClient: updatedRoom.lastReadByClient,
      lastReadByAgent: updatedRoom.lastReadByAgent,
      createdAt: updatedRoom.createdAt,
      updatedAt: updatedRoom.updatedAt,
      markedMessageIds,
    };
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

  /**
   * 从消息 + 已读回执表实时计算未读数，彻底避免增量计数器因并发竞态导致的偏移。
   * 未读 = 对方发的消息中、当前用户尚未创建 readReceipt 的条数。
   */
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
    // 对方发送者：agent 看 client 消息，client 看 agent 消息
    const oppositeSender = userType === 'agent' ? 'client' : 'agent';

    // 一次性查出所有相关房间的未读消息（LEFT JOIN 回执过滤已读）
    const rooms = await this.prisma.chatRoom.findMany({
      where: {
        deletedAt: null,
        // 坐席端仅统计「待处理/进行中」等可行动会话的未读：已关闭/归档的会话视为已处理，
        // 其客户消息不再计入未读总数，避免「未读总数」在已解决会话上持续冒红点。
        ...(userType === 'agent' ? { status: { in: ['active', 'waiting'] } } : {}),
      },
      select: {
        roomId: true,
        clientEmail: true,
        status: true,
        messages: {
          where: {
            sender: oppositeSender,
            ...(userType === 'client' && userEmail
              ? {
                  readReceipts: {
                    none: { userEmail, userType: 'client' },
                  },
                }
              : userType === 'agent'
                ? {
                    readReceipts: {
                      none: { userType: 'agent' },
                    },
                  }
                : {}),
          },
          select: { id: true },
        },
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
      // client 类型只计算属于自己的会话
      if (userType === 'client' && room.clientEmail !== userEmail) continue;
      const unread = room.messages.length;
      totalUnread += unread;
      // 始终返回所有房间（含 unread=0），确保前端能正确重置已清空的徽标
      roomCounts.push({
        roomId: room.roomId,
        unreadCount: unread,
        clientEmail: room.clientEmail,
        status: room.status,
      });
    }

    return { totalUnread, roomCounts };
  }

  async resetNotificationCount(roomId: string, userType: 'client' | 'agent'): Promise<void> {
    const data: Prisma.ChatRoomUpdateInput =
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

    const data: Prisma.ChatRoomUpdateInput = { lastActivity: new Date() };
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
    const roomFilter: Prisma.ChatRoomWhereInput = { status: { in: ['active', 'waiting'] } };
    if (agentEmail) {
      roomFilter.assignedAgentEmail = agentEmail;
    }
    const where: Prisma.ChatMessageWhereInput = {
      room: roomFilter,
      sender: 'client',
      isRead: false,
    };
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
    const data: Prisma.ChatRoomUpdateManyMutationInput = { status, lastActivity: new Date() };
    if (status === 'closed') data.closedAt = new Date();
    if (status === 'archived') data.archivedAt = new Date();
    const res = await this.prisma.chatRoom.updateMany({
      where: {
        roomId: { in: roomIds },
        deletedAt: null,
        // 业内最佳实践：归档是「后解决」内务操作，仅允许已关闭会话（Zendesk/Intercom/Freshchat 共识）。
        // 跳过关闭会绕过访客通知、坐席容量释放、审计消息等关键副作用。
        ...(status === 'archived' ? { status: 'closed' } : {}),
      },
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
