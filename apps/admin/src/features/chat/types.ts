import type { ContentOperatorUser } from '@/features/types';

export type ChatMessageSender = 'client' | 'agent' | 'system';

/** 用户在线状态（服务端 presence 系统推送） */
export type PresenceStatus = 'online' | 'away' | 'offline';

/** 聊天消息附件（与后端 ChatAttachmentItem 对应） */
export interface ChatAttachment {
  id: string;
  key: string;
  fileName: string;
  contentType: string;
  size: number;
  /** 公开访问 URL（由后端 S3 key 现拼） */
  url: string;
}

export interface ChatMessage {
  messageId: string;
  content: string;
  sender: ChatMessageSender;
  senderEmail?: string;
  /** ISO 字符串（后端返回 Date 序列化后的字符串） */
  timestamp: string;
  isRead: boolean;
  attachments?: ChatAttachment[];
  readBy?: Array<{
    userEmail: string;
    userType: ChatMessageSender;
    readAt: string;
  }>;
}

export type ChatRoomStatusKey = 'active' | 'waiting' | 'closed' | 'archived';

/** 列表用的「最后一条消息」预览（不含完整消息体，P0 性能根因修复） */
export interface ChatRoomLastMessage {
  messageId: string;
  content: string | null;
  sender: ChatMessageSender;
  senderEmail?: string;
  /** ISO 字符串 */
  timestamp: string;
  attachmentCount: number;
}

/** 按聊天内容搜索时命中的消息片段（仅正文命中的会话有值，供列表高亮 + 跳转定位） */
export interface ChatRoomMatchedMessage {
  messageId: string;
  content: string;
  sender: ChatMessageSender;
  /** ISO 字符串 */
  timestamp: string;
}

export interface ChatRoom {
  roomId: string;
  clientEmail: string;
  clientName?: string;
  status: ChatRoomStatusKey;
  assignedAgentEmail?: string;
  /** 负责人账号信息（后端随列表/详情返回，供 hover 资料卡展示） */
  assignedAgentUser?: ContentOperatorUser | null;
  /** 完整消息体：仅在「打开会话」时由 getChatRoom 拉取并填充（列表项可缺省） */
  messages?: ChatMessage[];
  /** 列表预览：最后一条消息（来自后端 lastMessage 字段） */
  lastMessage?: ChatRoomLastMessage | null;
  /** 列表预览：消息总数（来自后端 messageCount 字段） */
  messageCount?: number;
  /** ISO 字符串 */
  lastActivity: string;
  closedAt?: string;
  unreadCountForClient: number;
  unreadCountForAgent: number;
  lastReadByClient?: string;
  lastReadByAgent?: string;
  notes?: string;
  tags?: string[];
  // 访客画像（服务端 enrichment，创建会话时写入）
  ipMasked?: string;
  country?: string;
  region?: string;
  city?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
  referrer?: string;
  referrerHost?: string;
  landingPath?: string;
  source?: string;
  /** 访客当前在线状态（由服务端 presence 系统注入） */
  clientPresence?: PresenceStatus;
  /** 访客是否当前打开了聊天面板（独立 engagement 信号，不影响在线态） */
  clientPanelOpen?: boolean;
  /** 已转化客户 ID（坐席将访客转为客户线索后写入） */
  customerId?: string;
  /** 按聊天内容搜索时命中的消息片段（正文命中的会话有值，供高亮 + 跳转） */
  matchedMessage?: ChatRoomMatchedMessage | null;
}

/**
 * 访客档案（GET /chat-rooms/:roomId/visitor-profile）：对齐「访客分析」的数据与
 * 「依据 IP 取位置」原理——地区在读取时按原始 IP 重解析（省市区 + 运营商），
 * 并聚合该访客站内 PV/UV/会话数/首末访问/营销归因。
 */
export interface ChatVisitorProfile {
  ipMasked?: string | null;
  /** 读取时重解析的最精确地址，失败回退入库 GeoIP 值 */
  location: string | null;
  /** 运营商（仅 IP 解析命中时有值） */
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
  /** 站内行为聚合（无关联访客/无浏览记录时为 null） */
  pageViews: number | null;
  sessions: number | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  trafficSource: string | null;
  /** 该访客的历史会话数 */
  chatRoomCount: number;
}

export interface ChatRoomStats {
  totalRooms: number;
  statusBreakdown: {
    active: number;
    waiting: number;
    closed: number;
    archived: number;
  };
  totalMessages: number;
}

/** 后端 GET /chat-rooms 返回的 data 形状（游标分页，无 total） */
export interface ChatRoomsResponseData {
  rooms: ChatRoom[];
  nextCursor: string | null;
}
