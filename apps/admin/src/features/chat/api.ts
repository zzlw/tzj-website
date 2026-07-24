import { BASE_PATH } from '@/lib/config';
import type { ChatRoom, ChatRoomStats, ChatRoomsResponseData, ChatVisitorProfile } from './types';

// 走 Next.js BFF 代理（/api/bff/[...path]）：服务端读取 httpOnly access cookie
// 并附加 Authorization header，401 时自动刷新令牌。
// 此前直连 API（NEXT_PUBLIC_CHAT_API_URL）不带鉴权 → 所有受保护端点 401 静默失败
// → 刷新后历史消息拉不回来。
const API_URL = `${BASE_PATH}/api/bff`;

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

export interface GetChatRoomsParams {
  /** 状态：单一值或逗号分隔多值（如 "closed,archived"） */
  status?: string;
  clientEmail?: string;
  assignedAgentEmail?: string;
  /** 服务端搜索关键字（匹配访客名/邮箱） */
  search?: string;
  /** 游标分页：上一页 nextCursor；首屏留空 */
  cursor?: string;
  take?: number;
  /** 按分析访客 ID 筛选（访客档案抽屉用） */
  visitorId?: string;
}

export function getChatRooms(params: GetChatRoomsParams = {}): Promise<ChatRoomsResponseData> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.clientEmail) qs.set('clientEmail', params.clientEmail);
  if (params.assignedAgentEmail) qs.set('assignedAgentEmail', params.assignedAgentEmail);
  if (params.search) qs.set('search', params.search);
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.take) qs.set('take', String(params.take));
  if (params.visitorId) qs.set('visitorId', params.visitorId);
  const query = qs.toString();
  return request<ChatRoomsResponseData>(`/chat-rooms${query ? `?${query}` : ''}`);
}

export type BatchChatRoomAction = 'close' | 'archive' | 'delete';

export function batchChatRooms(
  action: BatchChatRoomAction,
  roomIds: string[],
): Promise<{ action: BatchChatRoomAction; count: number }> {
  return request(`/chat-rooms/batch`, {
    method: 'POST',
    body: JSON.stringify({ action, roomIds }),
  });
}

export function getChatRoom(roomId: string): Promise<ChatRoom> {
  return request<ChatRoom>(`/chat-rooms/${encodeURIComponent(roomId)}`);
}

/** 访客档案：IP 重解析地区 + 运营商 + 站内行为/营销归因（对齐「访客分析」）。 */
export function getChatVisitorProfile(roomId: string): Promise<ChatVisitorProfile> {
  return request<ChatVisitorProfile>(`/chat-rooms/${encodeURIComponent(roomId)}/visitor-profile`);
}

export function updateChatRoom(
  roomId: string,
  body: {
    status?: ChatRoom['status'];
    assignedAgentEmail?: string;
    notes?: string;
    tags?: string[];
  },
): Promise<ChatRoom> {
  return request<ChatRoom>(`/chat-rooms/${encodeURIComponent(roomId)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function closeChatRoom(
  roomId: string,
  closedBy: string,
  reason?: string,
): Promise<ChatRoom> {
  return request<ChatRoom>(`/chat-rooms/${encodeURIComponent(roomId)}/close`, {
    method: 'POST',
    body: JSON.stringify({ closedBy, reason }),
  });
}

export function getChatStats(): Promise<ChatRoomStats> {
  return request<ChatRoomStats>('/chat-rooms/stats/overview');
}

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
  return request<PresignAttachmentResult>(
    `/chat-rooms/${encodeURIComponent(roomId)}/attachments/presign`,
    {
      method: 'POST',
      body: JSON.stringify({ fileName, contentType, size, senderEmail }),
    },
  );
}
