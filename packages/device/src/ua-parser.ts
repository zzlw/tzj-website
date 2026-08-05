/// <reference path="./types/amplitude-ua-parser-js.d.ts" />

import UAParser from '@amplitude/ua-parser-js';

export interface ParsedUserAgent {
  /** desktop / mobile / tablet / unknown（UA 无 device.type 时归为 desktop） */
  deviceType: string;
  /** 设备型号（Android 多可识别，如 SM-S911B；iOS/桌面端多为通用值或 null） */
  deviceModel: string | null;
  /** 设备厂商（Apple / Samsung / Huawei…；桌面端多为 null） */
  deviceVendor: string | null;
  /** 浏览器名（Chrome / Safari / Edge…） */
  browser: string;
  /** 浏览器版本（完整版本串，如 120.0.0.0） */
  browserVersion: string | null;
  /** 操作系统（Windows / macOS / iOS / Android…） */
  os: string;
  /** 系统版本（如 10 / 17.1 / 13） */
  osVersion: string | null;
  /** 内嵌浏览器宿主 App（微信 / 抖音 / 微博…）；独立浏览器为 null */
  clientApp: string | null;
  isBot: boolean;
}

const BOT_RE =
  /bot|crawler|spider|slurp|bingpreview|headless|lighthouse|facebookexternalhit|whatsapp|preview/i;

/**
 * 国内/主流超级 App 的内嵌 WebView 识别表（@amplitude/ua-parser-js 覆盖不全，需自定义层）。
 * 顺序敏感：更具体的规则在前（如企业微信 wxwork 需先于微信 MicroMessenger）。
 */
const CLIENT_APP_RULES: Array<{ label: string; re: RegExp }> = [
  { label: '企业微信', re: /wxwork/i },
  { label: '微信', re: /micromessenger/i },
  { label: '抖音', re: /aweme|bytedancewebview|(?:^|[^a-z])douyin/i },
  { label: 'TikTok', re: /musical_ly|tiktok|(?:^|[^a-z])trill/i },
  { label: '微博', re: /weibo|__weibo__/i },
  { label: '小红书', re: /xhs|xiaohongshu/i },
  { label: '支付宝', re: /alipayclient|(?:^|[^a-z])alipay/i },
  { label: '钉钉', re: /dingtalk/i },
  { label: '飞书', re: /lark|feishu/i },
  { label: '快手', re: /kwai|kuaishou/i },
  { label: '百度App', re: /baiduboxapp/i },
  // QQ 客户端（排除 QQ 浏览器 MQQBrowser/QQBrowser）
  { label: 'QQ', re: /(?:^|\s)qq\/[\d.]+/i },
];

function detectClientApp(ua: string): string | null {
  const isQqBrowser = /mqqbrowser|qqbrowser/i.test(ua);
  for (const rule of CLIENT_APP_RULES) {
    if (rule.label === 'QQ' && isQqBrowser) continue;
    if (rule.re.test(ua)) return rule.label;
  }
  return null;
}

function normalize(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * UA 解析：基于 @amplitude/ua-parser-js（型号/版本/厂商）+ 自定义内嵌 App 识别层。
 *
 * 兼容映射（保持与旧 ua-parser-js@2 的统计口径一致，避免分析报表出现新分桶）：
 * - @amplitude 把百度 App 浏览器名解析为 baiduboxapp，统一回写 Baidu；
 * - @amplitude 不区分桌面/移动 Chrome，按 v2 习惯把手机 Chrome 回写 Mobile Chrome；
 * - 鸿蒙统一识别：OpenHarmony（HarmonyOS NEXT）与 HarmonyOS 都归一到 HarmonyOS；
 *   版本只取 UA 中显式声明的鸿蒙版本，避免兼容安卓模式的 UA 误用 Android 版本。
 */
export function parseUserAgent(ua?: string | null): ParsedUserAgent {
  if (!ua?.trim()) {
    return {
      deviceType: 'unknown',
      deviceModel: null,
      deviceVendor: null,
      browser: 'unknown',
      browserVersion: null,
      os: 'unknown',
      osVersion: null,
      clientApp: null,
      isBot: false,
    };
  }

  const result = new UAParser(ua).getResult();

  const rawBrowserName = result.browser.name === 'baiduboxapp' ? 'Baidu' : result.browser.name;
  const browserName =
    result.device.type === 'mobile' && rawBrowserName === 'Chrome'
      ? 'Mobile Chrome'
      : rawBrowserName;

  let osName = result.os.name ?? null;
  let osVersion = result.os.version ?? null;
  if (/harmonyos|openharmony/i.test(ua)) {
    osName = 'HarmonyOS';
    osVersion =
      ua.match(/openharmony\s+([\d.]+)/i)?.[1] ??
      ua.match(/harmonyos\s+([\d.]+)/i)?.[1] ??
      null;
  }

  return {
    deviceType: result.device.type ?? 'desktop',
    deviceModel: normalize(result.device.model),
    deviceVendor: normalize(result.device.vendor),
    browser: normalize(browserName) ?? 'Other',
    browserVersion: normalize(result.browser.version),
    os: normalize(osName) ?? 'Other',
    osVersion: normalize(osVersion),
    clientApp: detectClientApp(ua),
    isBot: BOT_RE.test(ua),
  };
}

/** 是否为手机（排除平板/桌面）。 */
export function isMobileUserAgent(userAgent: string): boolean {
  return parseUserAgent(userAgent).deviceType === 'mobile';
}

/**
 * 百度 App（含鸿蒙版）UA 识别。
 *
 * 百度搜索资源平台官方公告与业内通用标记均为 `baiduboxapp`。
 * 大小写不敏感，兼容旧版 iOS 的 `BaiduBoxAPP`。
 * 刻意不匹配桌面百度浏览器（BaiduBrowser）与百度爬虫（Baiduspider）。
 * 注：@amplitude/ua-parser-js 将百度 App 与百度手机浏览器都识别为不同名字，
 * 但官方标记更稳定，故保留正则（与 API 端 CLIENT_APP_RULES 同一分层思路）。
 */
export function isBaiduAppUserAgent(userAgent: string): boolean {
  return /baiduboxapp/i.test(userAgent);
}
