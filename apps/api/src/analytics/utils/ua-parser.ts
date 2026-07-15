export interface ParsedUserAgent {
  deviceType: string;
  browser: string;
  os: string;
  isBot: boolean;
}

const BOT_RE =
  /bot|crawler|spider|slurp|bingpreview|headless|lighthouse|facebookexternalhit|whatsapp|preview/i;

/** 轻量 UA 解析（无需外部依赖，满足运营看板维度）。 */
export function parseUserAgent(ua?: string | null): ParsedUserAgent {
  if (!ua?.trim()) {
    return {
      deviceType: 'unknown',
      browser: 'unknown',
      os: 'unknown',
      isBot: false,
    };
  }

  const lower = ua.toLowerCase();
  const isBot = BOT_RE.test(ua);

  let deviceType = 'desktop';
  if (/mobile|android.*mobile|iphone|ipod|windows phone/i.test(ua)) {
    deviceType = 'mobile';
  } else if (/ipad|tablet|android(?!.*mobile)/i.test(ua)) {
    deviceType = 'tablet';
  }

  let browser = 'Other';
  if (lower.includes('edg/')) browser = 'Edge';
  else if (lower.includes('chrome/') && !lower.includes('edg/')) browser = 'Chrome';
  else if (lower.includes('firefox/')) browser = 'Firefox';
  else if (lower.includes('safari/') && !lower.includes('chrome/')) browser = 'Safari';

  let os = 'Other';
  if (lower.includes('windows')) os = 'Windows';
  else if (lower.includes('mac os') || lower.includes('macintosh')) os = 'macOS';
  else if (lower.includes('linux') && !lower.includes('android')) os = 'Linux';
  else if (/iphone|ipad|ipod/.test(lower)) os = 'iOS';
  else if (lower.includes('android')) os = 'Android';

  return { deviceType, browser, os, isBot };
}
