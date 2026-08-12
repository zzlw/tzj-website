/**
 * @tzj/utils — 跨端通用工具函数包
 * 供 C 端（web）、B 端（admin）与 API 共享，避免各端手写重复逻辑。
 */

export {
  type ChatDayLabelOptions,
  type ChatListTimeOptions,
  type ChatTimeInput,
  formatChatDayLabel,
  formatChatListTime,
  formatChatTime,
  isSameChatDay,
} from './chat-time.js';
export { isUsableExternalUrl } from './external-url.js';
