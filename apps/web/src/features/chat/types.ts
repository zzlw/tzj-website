export type ChatMessageSender = 'client' | 'agent' | 'system';

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

export interface ChatRoom {
  roomId: string;
  clientEmail: string;
  clientName?: string;
  status: ChatRoomStatusKey;
  assignedAgentEmail?: string;
  messages: ChatMessage[];
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
  /** ISO 字符串，首次进入时间（用于「首次访问」展示） */
  createdAt?: string;
}

/** 后端 GET /chat-rooms/client/:email?recent=true 返回的 data 形状 */
export interface RecentRoomData {
  room: ChatRoom | null;
  canCreateNewRoom: boolean;
}
