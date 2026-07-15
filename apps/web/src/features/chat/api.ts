import type { ChatRoom, RecentRoomData } from './types';

const API_URL = (process.env.NEXT_PUBLIC_CHAT_API_URL ?? 'http://localhost:4000/api/v1').replace(
  /\/$/,
  '',
);

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
    throw new Error(`聊天服务请求失败 (${res.status})`);
  }
  const json = (await res.json()) as { data?: T; success?: boolean };
  return json.data as T;
}

const enc = encodeURIComponent;

/** 查询访客最近会话及是否可新建 */
export function getRecentRoom(clientEmail: string): Promise<RecentRoomData> {
  return request<RecentRoomData>(`/chat-rooms/client/${enc(clientEmail)}/recent`);
}

/** 新建会话（访客发起） */
export function createRoom(body: {
  clientEmail: string;
  clientName?: string;
  initialMessage?: string;
  userAgent?: string;
  referrer?: string;
  landingPath?: string;
  /** UTM source / 渠道来源 */
  source?: string;
}): Promise<ChatRoom> {
  return request<ChatRoom>(`/chat-rooms`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** 收集访客上下文，随会话创建一并上报（IP 由服务端提取，此处仅上报客户端可得项） */
export function collectVisitorContext(): {
  userAgent: string;
  referrer: string;
  landingPath: string;
  source?: string;
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
  };
}

/** 获取单个会话（含消息） */
export function getRoom(roomId: string): Promise<ChatRoom> {
  return request<ChatRoom>(`/chat-rooms/${enc(roomId)}`);
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
