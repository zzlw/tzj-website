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

export interface ChatRoom {
  roomId: string;
  clientEmail: string;
  clientName?: string;
  status: ChatRoomStatusKey;
  assignedAgentEmail?: string;
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
  /** 已转化客户 ID（坐席将访客转为客户线索后写入） */
  customerId?: string;
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
