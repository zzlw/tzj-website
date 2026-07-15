import type { ChatRoom, ChatRoomStats, ChatRoomsResponseData } from './types';

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
}

export function getChatRooms(params: GetChatRoomsParams = {}): Promise<ChatRoomsResponseData> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.clientEmail) qs.set('clientEmail', params.clientEmail);
  if (params.assignedAgentEmail) qs.set('assignedAgentEmail', params.assignedAgentEmail);
  if (params.search) qs.set('search', params.search);
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.take) qs.set('take', String(params.take));
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
