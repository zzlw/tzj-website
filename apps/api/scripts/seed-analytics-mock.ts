/**
 * 开发专用：访客分析假数据脚本（DEV ONLY）。
 *
 * 用途：为 admin「访客分析」页快速灌入可视化用的演示数据，覆盖
 *   全部渠道分组（paid / organic / social / email / referral / direct）、
 *   多个广告系列、多设备 / 浏览器 / 操作系统、多地区（真实公网 IP 便于重解析），
 *   并按「会话首触归因」语义为同一访客的多次浏览锁定同一渠道。
 *
 * 用法：
 *   pnpm --filter @tzj/api exec tsx scripts/seed-analytics-mock.ts            # 追加约 140 名访客的浏览
 *   pnpm --filter @tzj/api exec tsx scripts/seed-analytics-mock.ts --clear    # 先清除旧的 mock 数据再灌入
 *   pnpm --filter @tzj/api exec tsx scripts/seed-analytics-mock.ts --only-clear# 仅清除 mock 数据
 *   pnpm --filter @tzj/api exec tsx scripts/seed-analytics-mock.ts --visitors=200
 *
 * 安全：所有行以 visitorId / sessionId 前缀 "mock_" 标记，--clear 只删除这些行，
 *       绝不触碰真实采集数据。生产环境请勿运行。
 */
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MOCK_PREFIX = 'mock_';

// ---- 命令行参数 ----
const argv = process.argv.slice(2);
const hasFlag = (name: string) => argv.includes(`--${name}`);
const getNum = (name: string, def: number) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  const n = hit ? Number(hit.split('=')[1]) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
};

const DO_CLEAR = hasFlag('clear') || hasFlag('only-clear');
const ONLY_CLEAR = hasFlag('only-clear');
const VISITOR_COUNT = getNum('visitors', 140);

// ---- 随机工具 ----
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function weighted<T>(items: ReadonlyArray<readonly [T, number]>): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of items) {
    r -= w;
    if (r <= 0) return v;
  }
  return items[items.length - 1][0];
}
function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// ---- 数据池 ----
type Channel = 'paid' | 'organic' | 'social' | 'email' | 'referral' | 'direct';

interface Campaign {
  source: string;
  medium: string;
  campaign: string | null;
  content?: string | null;
  gclid?: boolean;
  referrer?: string | null;
}

// 每个渠道的落地归因配置（会话首触，同一访客所有浏览共用）
const CHANNEL_CONFIG: Record<Channel, Campaign[]> = {
  paid: [
    {
      source: 'google',
      medium: 'cpc',
      campaign: 'summer_sale',
      content: 'search_ad_a',
      gclid: true,
    },
    {
      source: 'google',
      medium: 'cpc',
      campaign: 'brand_search',
      content: 'search_ad_b',
      gclid: true,
    },
    { source: 'bing', medium: 'cpc', campaign: 'retargeting', content: 'display_1', gclid: false },
    { source: 'google', medium: 'display', campaign: 'summer_sale', content: 'banner_970x250' },
  ],
  organic: [
    { source: 'google', medium: 'organic', campaign: null, referrer: 'https://www.google.com/' },
    { source: 'bing', medium: 'organic', campaign: null, referrer: 'https://www.bing.com/' },
    { source: 'baidu', medium: 'organic', campaign: null, referrer: 'https://www.baidu.com/' },
  ],
  social: [
    {
      source: 'facebook',
      medium: 'social',
      campaign: 'fb_launch',
      referrer: 'https://www.facebook.com/',
    },
    {
      source: 'linkedin',
      medium: 'social',
      campaign: 'linkedin_promo',
      referrer: 'https://www.linkedin.com/',
    },
    { source: 'weibo', medium: 'social', campaign: 'weibo_topic', referrer: 'https://weibo.com/' },
  ],
  email: [
    { source: 'newsletter', medium: 'email', campaign: 'newsletter_july' },
    { source: 'sendgrid', medium: 'newsletter', campaign: 'product_update' },
  ],
  referral: [
    {
      source: null as unknown as string,
      medium: 'referral',
      campaign: null,
      referrer: 'https://www.fireindustry.org/',
    },
    {
      source: null as unknown as string,
      medium: 'referral',
      campaign: null,
      referrer: 'https://partners.example.com/',
    },
  ],
  direct: [{ source: null as unknown as string, medium: 'direct', campaign: null, referrer: null }],
};

// 渠道分布权重（贴近真实 B 端工业官网：自然搜索 + 直接为主，付费其次）
const CHANNEL_WEIGHTS: ReadonlyArray<readonly [Channel, number]> = [
  ['organic', 30],
  ['direct', 22],
  ['paid', 20],
  ['referral', 12],
  ['social', 10],
  ['email', 6],
];

const PATHS: ReadonlyArray<readonly [string, string]> = [
  ['/', '天纵集团 - 消防训练塔专业制造商'],
  ['/products', '产品中心'],
  ['/products/fire-training-tower', '模块化消防训练塔'],
  ['/products/smoke-training-facility', '烟热训练设施'],
  ['/solutions', '解决方案'],
  ['/cases', '工程案例'],
  ['/news', '新闻资讯'],
  ['/about', '关于我们'],
  ['/contact', '联系我们'],
];

// 页面标题查表（供 journey 逐页取标题）
const PATH_TITLE: Record<string, string> = Object.fromEntries(PATHS);

// 真实浏览动线（有序、连贯）：每个会话取其中一条动线的前 N 页，
// 保证轨迹符合 B 端选型路径，并让「关键页触达（联系 / 案例·方案）」自然分布。
const JOURNEYS: ReadonlyArray<ReadonlyArray<string>> = [
  ['/', '/products', '/products/fire-training-tower', '/contact'],
  ['/', '/solutions', '/cases', '/contact'],
  ['/products', '/products/smoke-training-facility', '/solutions'],
  ['/', '/cases', '/products', '/products/fire-training-tower'],
  ['/', '/news', '/about'],
  ['/products/fire-training-tower', '/contact'],
  ['/', '/about', '/contact'],
  ['/solutions', '/products', '/products/smoke-training-facility', '/cases', '/contact'],
];

// 已识别访客身份池（约 1/3 访客会关联到 visitors 表，列表显示「已识别」+ 姓名/公司/邮箱/电话）
const SURNAMES = [
  '张',
  '李',
  '王',
  '刘',
  '陈',
  '杨',
  '赵',
  '黄',
  '周',
  '吴',
  '徐',
  '孙',
  '马',
  '胡',
  '林',
];
const GIVEN = [
  '伟',
  '芳',
  '磊',
  '强',
  '军',
  '洋',
  '勇',
  '杰',
  '涛',
  '明',
  '超',
  '刚',
  '静',
  '敏',
  '娟',
];
const COMPANY_CORE = [
  '华东消防',
  '蓝盾安全',
  '中安应急',
  '德安消防',
  '恒安科技',
  '安泰工程',
  '国泰安防',
  '江南消防',
];
const COMPANY_SUFFIX = ['有限公司', '集团', '股份有限公司', '科技有限公司', '工程有限公司'];
const EMAIL_DOMAIN = [
  'hd-fire.com',
  'landun-safety.cn',
  'zhongan-eq.com',
  'dean-fire.com',
  'firepro.cn',
  'anfang.com.cn',
];
const EMAIL_LOCAL = [
  'procurement',
  'sales',
  'buyer',
  'purchasing',
  'info',
  'engineer',
  'contact',
  'lead',
];

function makeIdentity(): { name: string; email: string; phone: string; company: string } {
  const name = pick(SURNAMES) + pick(GIVEN) + (Math.random() < 0.5 ? pick(GIVEN) : '');
  const company = pick(COMPANY_CORE) + pick(COMPANY_SUFFIX);
  const email = `${pick(EMAIL_LOCAL)}${randInt(1, 99)}@${pick(EMAIL_DOMAIN)}`;
  const phone = `1${pick(['38', '39', '35', '50', '88', '86', '59', '77'])}${randInt(10000000, 99999999)}`;
  return { name, email, phone, company };
}

// 设备档案：含真实 UA 串 + 型号/厂商/版本/内嵌 App（供新字段展示）
interface DeviceProfile {
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  deviceModel: string | null;
  deviceVendor: string | null;
  clientApp: string | null;
  ua: string;
}
const DESKTOP_UA: DeviceProfile[] = [
  {
    browser: 'Chrome',
    browserVersion: '120.0.0.0',
    os: 'Windows',
    osVersion: '10',
    deviceModel: null,
    deviceVendor: null,
    clientApp: null,
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
  {
    browser: 'Chrome',
    browserVersion: '119.0.0.0',
    os: 'macOS',
    osVersion: '14.1',
    deviceModel: 'Macintosh',
    deviceVendor: 'Apple',
    clientApp: null,
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  },
  {
    browser: 'Edge',
    browserVersion: '120.0.0.0',
    os: 'Windows',
    osVersion: '11',
    deviceModel: null,
    deviceVendor: null,
    clientApp: null,
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  },
  {
    browser: 'Firefox',
    browserVersion: '121.0',
    os: 'Windows',
    osVersion: '10',
    deviceModel: null,
    deviceVendor: null,
    clientApp: null,
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  },
  {
    browser: 'Safari',
    browserVersion: '17.1',
    os: 'macOS',
    osVersion: '14.1',
    deviceModel: 'Macintosh',
    deviceVendor: 'Apple',
    clientApp: null,
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  },
];
const MOBILE_UA: DeviceProfile[] = [
  {
    browser: 'Mobile Safari',
    browserVersion: '17.1',
    os: 'iOS',
    osVersion: '17.1',
    deviceModel: 'iPhone',
    deviceVendor: 'Apple',
    clientApp: null,
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  },
  {
    browser: 'Chrome',
    browserVersion: '120.0.0.0',
    os: 'Android',
    osVersion: '13',
    deviceModel: 'SM-S911B',
    deviceVendor: 'Samsung',
    clientApp: null,
    ua: 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  },
  {
    browser: 'WeChat',
    browserVersion: '8.0.49',
    os: 'Android',
    osVersion: '12',
    deviceModel: 'V2254A',
    deviceVendor: 'vivo',
    clientApp: '微信',
    ua: 'Mozilla/5.0 (Linux; Android 12; V2254A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.49.2560(0x28003137) NetType/WIFI',
  },
  {
    browser: 'WebKit',
    browserVersion: '605.1.15',
    os: 'iOS',
    osVersion: '16.6',
    deviceModel: 'iPhone',
    deviceVendor: 'Apple',
    clientApp: '抖音',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 aweme_1.0 JsSdk/2.0 NetType/WIFI',
  },
  {
    browser: 'Weibo',
    browserVersion: '13.2.0',
    os: 'Android',
    osVersion: '12',
    deviceModel: 'PGT-N19',
    deviceVendor: 'Huawei',
    clientApp: '微博',
    ua: 'Mozilla/5.0 (Linux; Android 12; PGT-N19) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Mobile Safari/537.36 Weibo (__weibo__13.2.0__android)',
  },
];
const TABLET_UA: DeviceProfile[] = [
  {
    browser: 'Mobile Safari',
    browserVersion: '17.1',
    os: 'iPadOS',
    osVersion: '17.1',
    deviceModel: 'iPad',
    deviceVendor: 'Apple',
    clientApp: null,
    ua: 'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  },
  {
    browser: 'Chrome',
    browserVersion: '120.0.0.0',
    os: 'Android',
    osVersion: '13',
    deviceModel: 'SM-X710',
    deviceVendor: 'Samsung',
    clientApp: null,
    ua: 'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
];

// 真实公网 IP 池（便于访客明细按 IP 重解析出地区/运营商）
// country 必须是 ISO 3166-1 alpha-2 代码（与真实 GeoIP 一致）：
// formatGeoLabel 用 Intl.DisplayNames(type:'region').of(country) 转中文，传中文名会抛 RangeError。
const IP_POOL: ReadonlyArray<{ ip: string; country: string; region: string; city: string }> = [
  { ip: '116.226.72.10', country: 'CN', region: '上海市', city: '上海市' },
  { ip: '123.123.123.123', country: 'CN', region: '北京市', city: '北京市' },
  { ip: '113.108.10.20', country: 'CN', region: '广东省', city: '广州市' },
  { ip: '183.14.30.40', country: 'CN', region: '广东省', city: '深圳市' },
  { ip: '58.34.20.10', country: 'CN', region: '江苏省', city: '南京市' },
  { ip: '60.191.5.6', country: 'CN', region: '浙江省', city: '杭州市' },
  { ip: '117.136.0.1', country: 'CN', region: '四川省', city: '成都市' },
  { ip: '111.63.1.2', country: 'CN', region: '湖北省', city: '武汉市' },
  { ip: '221.192.1.2', country: 'CN', region: '山东省', city: '青岛市' },
  { ip: '210.21.5.6', country: 'CN', region: '陕西省', city: '西安市' },
  { ip: '8.8.8.8', country: 'US', region: '加利福尼亚州', city: '山景城' },
  { ip: '104.244.42.1', country: 'US', region: '加利福尼亚州', city: '旧金山' },
  { ip: '203.0.113.25', country: 'AU', region: '新南威尔士州', city: '悉尼' },
  { ip: '88.221.10.20', country: 'DE', region: '巴伐利亚', city: '慕尼黑' },
  { ip: '160.16.10.20', country: 'JP', region: '东京都', city: '东京' },
];

function maskIp(ip: string): string {
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`;
  return ip;
}
function hashIp(ip: string): string {
  return createHash('sha256').update(`mock:${ip}`).digest('hex');
}

async function clearMock() {
  const res = await prisma.pageView.deleteMany({
    where: {
      OR: [{ visitorId: { startsWith: MOCK_PREFIX } }, { sessionId: { startsWith: MOCK_PREFIX } }],
    },
  });
  const vis = await prisma.visitor.deleteMany({
    where: { anonymousId: { startsWith: MOCK_PREFIX } },
  });
  console.log(`🧹 已清除 ${res.count} 条 mock 浏览记录、${vis.count} 名 mock 已识别访客`);
}

interface Row {
  visitorId: string;
  sessionId: string;
  path: string;
  title: string;
  referrer: string | null;
  referrerHost: string | null;
  userAgent: string | null;
  ipHash: string;
  ip: string;
  ipMasked: string;
  country: string;
  region: string;
  city: string;
  geoSource: string;
  deviceType: string;
  deviceModel: string | null;
  deviceVendor: string | null;
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  clientApp: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  gclid: string | null;
  trafficSource: Channel;
  isBot: boolean;
  createdAt: Date;
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

interface IdentifiedVisitor {
  visitorId: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

interface VisitorContext {
  visitorId: string;
  channel: Channel;
  attr: Campaign;
  geo: (typeof IP_POOL)[number];
  ua: DeviceProfile;
  deviceType: string;
}

function pickDeviceUa(): { deviceType: string; ua: DeviceProfile } {
  const deviceType = weighted([
    ['desktop', 60],
    ['mobile', 33],
    ['tablet', 7],
  ] as const);
  const ua =
    deviceType === 'mobile'
      ? pick(MOBILE_UA)
      : deviceType === 'tablet'
        ? pick(TABLET_UA)
        : pick(DESKTOP_UA);
  return { deviceType, ua };
}

function makeRow(ctx: VisitorContext, sessionId: string, path: string, t: number): Row {
  const { attr, geo, ua } = ctx;
  return {
    visitorId: ctx.visitorId,
    sessionId,
    path,
    title: PATH_TITLE[path] ?? path,
    referrer: attr.referrer ?? null,
    referrerHost: hostOf(attr.referrer ?? null),
    userAgent: ua.ua,
    ipHash: hashIp(geo.ip),
    ip: geo.ip,
    ipMasked: maskIp(geo.ip),
    country: geo.country,
    region: geo.region,
    city: geo.city,
    geoSource: 'ip',
    deviceType: ctx.deviceType,
    deviceModel: ua.deviceModel,
    deviceVendor: ua.deviceVendor,
    browser: ua.browser,
    browserVersion: ua.browserVersion,
    os: ua.os,
    osVersion: ua.osVersion,
    clientApp: ua.clientApp,
    utmSource: attr.source ?? null,
    utmMedium: attr.medium ?? null,
    utmCampaign: attr.campaign ?? null,
    utmContent: attr.content ?? null,
    gclid: attr.gclid ? `mock_gclid_${randInt(100000, 999999)}` : null,
    trafficSource: ctx.channel,
    isBot: false,
    createdAt: new Date(t),
  };
}

// 单个会话：取一条动线的前 N 页作为有序轨迹，回传首末时间
function buildSessionRows(ctx: VisitorContext, v: number, s: number, now: number) {
  const sessionId = `${MOCK_PREFIX}s_${v}_${s}_${randInt(1000, 9999)}`;
  // 时间：越近的天权重越高（今天必有一部分）
  const daysAgo = weighted([
    [0, 26],
    [1, 20],
    [2, 16],
    [3, 12],
    [4, 10],
    [5, 8],
    [6, 8],
  ] as const);
  const base = now - daysAgo * 86400000 - randInt(0, 20) * 3600000 - randInt(0, 59) * 60000;
  const journey = pick(JOURNEYS);
  const pages = journey.slice(0, randInt(1, journey.length));

  const rows: Row[] = [];
  let first = Number.POSITIVE_INFINITY;
  let last = 0;
  let t = base;
  for (const [p, path] of pages.entries()) {
    t += p === 0 ? 0 : randInt(20, 180) * 1000;
    first = Math.min(first, t);
    last = Math.max(last, t);
    rows.push(makeRow(ctx, sessionId, path, t));
  }
  return { rows, first, last };
}

// 单个访客：会话首触归因共用；已识别/高意向访客访问更频繁
function buildVisitorRows(v: number): { rows: Row[]; identity: IdentifiedVisitor | null } {
  const channel = weighted(CHANNEL_WEIGHTS);
  const { deviceType, ua } = pickDeviceUa();
  const ctx: VisitorContext = {
    visitorId: `${MOCK_PREFIX}v_${v}_${randInt(1000, 9999)}`,
    channel,
    attr: pick(CHANNEL_CONFIG[channel]),
    geo: pick(IP_POOL),
    ua,
    deviceType,
  };
  const isIdentified = Math.random() < 0.35;
  const sessionCount = isIdentified ? randInt(2, 4) : randInt(1, 3);
  const now = Date.now();

  const rows: Row[] = [];
  let first = Number.POSITIVE_INFINITY;
  let last = 0;
  for (let s = 0; s < sessionCount; s++) {
    const session = buildSessionRows(ctx, v, s, now);
    rows.push(...session.rows);
    first = Math.min(first, session.first);
    last = Math.max(last, session.last);
  }

  const identity =
    isIdentified && last > 0
      ? {
          visitorId: ctx.visitorId,
          ...makeIdentity(),
          firstSeenAt: new Date(first),
          lastSeenAt: new Date(last),
        }
      : null;
  return { rows, identity };
}

function buildRows(): { rows: Row[]; identified: IdentifiedVisitor[] } {
  const rows: Row[] = [];
  const identified: IdentifiedVisitor[] = [];
  for (let v = 0; v < VISITOR_COUNT; v++) {
    const { rows: visitorRows, identity } = buildVisitorRows(v);
    rows.push(...visitorRows);
    if (identity) identified.push(identity);
  }
  return { rows, identified };
}

async function main() {
  console.log('⚠️  开发专用假数据脚本（DEV ONLY）');

  if (DO_CLEAR) await clearMock();
  if (ONLY_CLEAR) {
    console.log('✅ 仅清除完成');
    return;
  }

  const { rows, identified } = buildRows();
  // 分批插入，避免单次参数过多
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const res = await prisma.pageView.createMany({ data: chunk });
    inserted += res.count;
  }

  // 已识别访客→写入 visitors 表（列表显示「已识别」姓名/公司/邮箱/电话）
  if (identified.length > 0) {
    await prisma.visitor.createMany({
      data: identified.map((it) => ({
        anonymousId: it.visitorId,
        email: it.email,
        name: it.name,
        phone: it.phone,
        company: it.company,
        firstSeenAt: it.firstSeenAt,
        lastSeenAt: it.lastSeenAt,
        identifiedAt: it.lastSeenAt,
      })),
      skipDuplicates: true,
    });
  }

  // 统计概览
  const byChannel = new Map<string, number>();
  for (const r of rows) byChannel.set(r.trafficSource, (byChannel.get(r.trafficSource) ?? 0) + 1);
  const visitors = new Set(rows.map((r) => r.visitorId)).size;
  const campaigns = new Set(rows.filter((r) => r.utmCampaign).map((r) => r.utmCampaign)).size;

  console.log(
    `✅ 已插入 ${inserted} 条浏览记录（${visitors} 名访客，其中 ${identified.length} 名已识别，${campaigns} 个广告系列）`,
  );
  console.log('   渠道分布（PV）：');
  for (const [ch, c] of [...byChannel.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`     - ${ch.padEnd(9)} ${c}`);
  }
  console.log(
    '👉 访客分析 http://localhost:3002/analytics · 访客会话 http://localhost:3002/visitors（默认近 7 天）',
  );
}

main()
  .catch((e) => {
    console.error('❌ 造数失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
