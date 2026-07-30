// 渠道分组（channel grouping）：参照 GA4 默认渠道归类，服务端单一计算。
// 输出：direct / organic / paid / social / email / referral / other

export type TrafficSource =
  | 'direct'
  | 'organic'
  | 'paid'
  | 'social'
  | 'email'
  | 'referral'
  | 'other';

export interface TrafficSourceInput {
  utmMedium?: string | null;
  utmSource?: string | null;
  gclid?: string | null;
  bdVid?: string | null;
  referrerHost?: string | null;
}

// utm_medium → 渠道映射（查表，避免长 if-else 链拉高复杂度）
const MEDIUM_CHANNEL: Record<string, TrafficSource> = {
  cpc: 'paid',
  ppc: 'paid',
  paid: 'paid',
  paidsearch: 'paid',
  'paid-search': 'paid',
  display: 'paid',
  cpm: 'paid',
  banner: 'paid',
  social: 'social',
  'social-network': 'social',
  'social-media': 'social',
  sm: 'social',
  email: 'email',
  newsletter: 'email',
  organic: 'organic',
  referral: 'referral',
  affiliate: 'referral',
};

// referrerHost 关键词 → 渠道（无 UTM 时兜底归类）
const SEARCH_HOSTS = [
  'google',
  'bing',
  'baidu',
  'sogou',
  'so.com',
  'yandex',
  'yahoo',
  'duckduckgo',
];
const SOCIAL_HOSTS = [
  'facebook',
  'twitter',
  'x.com',
  'linkedin',
  'weibo',
  'zhihu',
  't.co',
  'instagram',
  'youtube',
  'weixin', // 微信内打开（weixin110.qq.com 等安全跳转域）
];
// 自家域名（self-referral）：站内跳转不算引荐，参照 GA4 排除自引荐，归 direct
const INTERNAL_HOSTS = ['localhost', '127.0.0.1', 'tzjii.com'];

function classifyByReferrer(host: string): TrafficSource {
  const h = host.toLowerCase();
  if (INTERNAL_HOSTS.some((s) => h.includes(s))) return 'direct';
  if (SEARCH_HOSTS.some((s) => h.includes(s))) return 'organic';
  if (SOCIAL_HOSTS.some((s) => h.includes(s))) return 'social';
  return 'referral';
}

/**
 * 计算访问的渠道分组。优先级：付费点击标记/UTM 媒介 → UTM 来源 → referrer 归类 → 直接访问。
 */
export function classifyTrafficSource(input: TrafficSourceInput): TrafficSource {
  const medium = input.utmMedium?.trim().toLowerCase();
  if (input.gclid?.trim() || input.bdVid?.trim()) return 'paid';
  if (medium) return MEDIUM_CHANNEL[medium] ?? 'referral';
  // 有 utm_source 但无 medium：视为带标记的引荐
  if (input.utmSource?.trim()) return 'referral';
  const host = input.referrerHost?.trim();
  if (host) return classifyByReferrer(host);
  return 'direct';
}
