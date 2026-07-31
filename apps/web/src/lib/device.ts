/**
 * 可拨号的移动设备：手机才支持 tel: 直拨（桌面/平板跳协议弹窗体验差，不应触发）。
 * 两级判定（MDN/Chrome 官方推荐，零依赖）：
 *  1. 现代 Chromium 优先用结构化的 userAgentData.mobile（权威布尔，不受 UA Reduction 影响）；
 *  2. Safari/Firefox 回退 MDN 推荐的 Mobi 关键词——覆盖 iPhone/Android 手机/鸿蒙，并天然排除 iPad/平板。
 * 仅限客户端调用（依赖 navigator）。
 */
export function isDialableMobile(): boolean {
  const uaData = (navigator as Navigator & { userAgentData?: { mobile: boolean } }).userAgentData;
  if (uaData) return uaData.mobile;
  return /Mobi/i.test(navigator.userAgent);
}
