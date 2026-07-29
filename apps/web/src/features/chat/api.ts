import { getVisitorId } from '@/lib/analytics';
import { env } from '@/lib/env';
import type { ChatRoom, RecentRoomData } from './types';

const API_URL = env.chatApiUrl;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Chat service request failed (${res.status})`);
  }
  const json = (await res.json()) as { data?: T; success?: boolean };
  return json.data as T;
}

const enc = encodeURIComponent;

/** 查询访客最近会话及是否可新建 */
export function getRecentRoom(clientEmail: string): Promise<RecentRoomData> {
  return request<RecentRoomData>(`/chat-rooms/client/${enc(clientEmail)}/recent`);
}

/** 新建会话（访客发起）；服务端一并返回 chat token（P0 C1，用于 socket 握手鉴权） */
export function createRoom(body: {
  clientEmail: string;
  clientName?: string;
  initialMessage?: string;
  userAgent?: string;
  referrer?: string;
  landingPath?: string;
  /** UTM source / 渠道来源 */
  source?: string;
  /** 分析访客 ID（_tzj_vid），用于 B 端按人查聊天历史 */
  visitorId?: string;
}): Promise<ChatRoom & { token: string }> {
  return request<ChatRoom & { token: string }>(`/chat-rooms`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** 访客重连换 token（P0 C1）：凭 roomId + clientEmail 换取短期 chat token */
export function fetchVisitorToken(
  roomId: string,
  clientEmail: string,
): Promise<{ token: string; roomId: string; clientEmail: string }> {
  return request(`/chat-rooms/visitor-token`, {
    method: 'POST',
    body: JSON.stringify({ roomId, clientEmail }),
  });
}

/** 收集访客上下文，随会话创建一并上报（IP 由服务端提取，此处仅上报客户端可得项） */
export function collectVisitorContext(): {
  userAgent: string;
  referrer: string;
  landingPath: string;
  source?: string;
  visitorId?: string;
} {
  if (typeof window === 'undefined') {
    return { userAgent: '', referrer: '', landingPath: '/' };
  }
  const params = new URLSearchParams(window.location.search);
  const utm = params.get('utm_source')?.trim();
  return {
    userAgent: navigator.userAgent,
    referrer: document.referrer || '',
    landingPath: window.location.pathname,
    source: utm || undefined,
    // 关联分析访客身份，供 B 端「访客会话」页按人下钻聊天记录
    visitorId: getVisitorId() || undefined,
  };
}

/** 获取单个会话（含消息）——走访客专属公开端点，凭 clientEmail 校验归属。
 * 此前复用管理端 GET :roomId（需 chat.view 权限）→ 匿名 401 静默失败。 */
export function getRoom(roomId: string, clientEmail: string): Promise<ChatRoom> {
  return request<ChatRoom>(`/chat-rooms/client/${enc(clientEmail)}/rooms/${enc(roomId)}`);
}

/** 获取附件预签名上传 URL（浏览器直传 S3/OSS） */
export interface PresignAttachmentResult {
  key: string;
  uploadUrl: string;
  publicUrl: string;
  expiresIn: number;
}

export function presignChatAttachment(
  roomId: string,
  fileName: string,
  contentType: string,
  size: number,
  senderEmail: string,
): Promise<PresignAttachmentResult> {
  return request<PresignAttachmentResult>(`/chat-rooms/${enc(roomId)}/attachments/presign`, {
    method: 'POST',
    body: JSON.stringify({ fileName, contentType, size, senderEmail }),
  });
}

/** HTTP 兜底发送消息（socket 未连时），支持附件 */
export function sendMessageHTTP(
  roomId: string,
  content: string,
  senderEmail: string,
  attachments?: string[],
): Promise<ChatRoom> {
  return request<ChatRoom>(`/chat-rooms/${enc(roomId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      content,
      sender: 'client',
      senderEmail,
      attachments,
    }),
  });
}

/** HTTP 兜底标记已读 */
export function markReadHTTP(roomId: string, userEmail: string): Promise<ChatRoom> {
  return request<ChatRoom>(`/chat-rooms/${enc(roomId)}/messages/read`, {
    method: 'PUT',
    body: JSON.stringify({ userEmail, userType: 'client' }),
  });
}

/** 坐席可用性（公开端点，无需 token）：访客端 mount 时立即获取在线状态 */
export interface AgentAvailability {
  online: number;
  away: number;
  lastOnlineAt: number | null;
}

export function fetchAgentAvailability(): Promise<AgentAvailability> {
  return request<AgentAvailability>('/chat-rooms/agent-availability');
}
