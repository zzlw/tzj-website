/**
 * 跨组件「打开客服面板」协议：ChatWidget 挂在全站 layout，营销弹窗等任意
 * 客户端组件无法直接拿到其内部状态，通过 window CustomEvent 解耦联动。
 * ChatWidget 监听该事件：打开面板；携带 message 时自动作为访客消息发送。
 */
export const OPEN_CHAT_EVENT = 'tzj:chat:open';

export interface OpenChatDetail {
  /** 打开面板后自动发送的访客消息（可选；空则仅打开面板） */
  message?: string;
}

export function openChat(detail: OpenChatDetail = {}): void {
  window.dispatchEvent(new CustomEvent<OpenChatDetail>(OPEN_CHAT_EVENT, { detail }));
}
