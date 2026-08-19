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

/**
 * ChatWidget 懒加载期间的事件缓冲：组件 chunk 尚在加载时（营销弹窗 CTA
 * 可能在挂载窗口内触发 openChat），事件暂存于此；ChatWidget 注册监听后
 * 调用 markChatWidgetReady() 回放，消除事件丢失窗口。
 */
let chatWidgetReady = false;
const pendingOpens: OpenChatDetail[] = [];

export function openChat(detail: OpenChatDetail = {}): void {
  if (!chatWidgetReady) {
    pendingOpens.push(detail);
    return;
  }
  window.dispatchEvent(new CustomEvent<OpenChatDetail>(OPEN_CHAT_EVENT, { detail }));
}

/** ChatWidget 注册事件监听后调用：标记就绪并回放缓冲期内的打开请求。 */
export function markChatWidgetReady(): void {
  chatWidgetReady = true;
  for (const detail of pendingOpens.splice(0)) {
    window.dispatchEvent(new CustomEvent<OpenChatDetail>(OPEN_CHAT_EVENT, { detail }));
  }
}
