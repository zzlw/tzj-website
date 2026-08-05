import { isMobileUserAgent } from './ua-parser.js';

/**
 * 可拨号的移动设备：手机才支持 tel: 直拨（桌面/平板跳协议弹窗体验差，不应触发）。
 * 两级判定：
 *  1. 现代 Chromium 优先用结构化的 userAgentData.mobile（权威布尔，不受 UA Reduction 影响）；
 *  2. Safari/Firefox 回退共享解析器的 device.type（mobile/tablet 区分，
 *     避免旧 Mobi 关键词把同样带 "Mobile/…" 的 iPad 误判成手机）。
 * 仅限客户端调用（依赖 navigator）；服务端调用时安全返回 false。
 */
export function isDialableMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const uaData = (navigator as Navigator & { userAgentData?: { mobile: boolean } }).userAgentData;
  if (uaData) return uaData.mobile;
  return isMobileUserAgent(navigator.userAgent);
}
