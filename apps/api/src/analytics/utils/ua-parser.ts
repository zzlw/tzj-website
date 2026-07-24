import { UAParser } from 'ua-parser-js';

export interface ParsedUserAgent {
  /** desktop / mobile / tablet / unknown */
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
 * 国内/主流超级 App 的内嵌 WebView 识别表（ua-parser-js 覆盖不全，需自定义层）。
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

/** UA 解析：基于 ua-parser-js（型号/版本/厂商） + 自定义内嵌 App 识别层。 */
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

  return {
    // ua-parser 对桌面端不返回 device.type，默认归为 desktop
    deviceType: result.device.type ?? 'desktop',
    deviceModel: normalize(result.device.model),
    deviceVendor: normalize(result.device.vendor),
    browser: normalize(result.browser.name) ?? 'Other',
    browserVersion: normalize(result.browser.version),
    os: normalize(result.os.name) ?? 'Other',
    osVersion: normalize(result.os.version),
    clientApp: detectClientApp(ua),
    isBot: BOT_RE.test(ua),
  };
}
