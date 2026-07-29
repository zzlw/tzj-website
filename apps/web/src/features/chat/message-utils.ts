import type { ChatMessage } from '@/features/chat/types';

/** 服务端偶发返回数值时间戳，统一归一化为 ISO 字符串（领域层共享，供 hooks 与组件使用） */
export function normalizeMessage(m: ChatMessage): ChatMessage {
  return {
    ...m,
    timestamp: typeof m.timestamp === 'string' ? m.timestamp : new Date(m.timestamp).toISOString(),
  };
}
