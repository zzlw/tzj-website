/**
 * @tzj/device — 跨端统一的 UA / 设备检测包
 * 供 C 端（web）、B 端（admin）与 API 共享，避免各端手写重复规则。
 */

export { isDialableMobile } from './device.js';
export {
  isBaiduAppUserAgent,
  isMobileUserAgent,
  type ParsedUserAgent,
  parseUserAgent,
} from './ua-parser.js';
