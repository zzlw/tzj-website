/**
 * 开发专用：访客中心假数据脚本（DEV ONLY）。
 *
 * 用途：为 admin「访客中心」页灌入演示数据 —— 生成一批分析访客（Visitor）
 *   及其对应的浏览埋点（PageView），覆盖桌面/移动/平板、多浏览器/OS、
 *   多省市地域、多流量来源与 UTM 归因，部分访客已识别（含邮箱/姓名/公司），
 *   使访客列表、设备/浏览器兼容性统计、访客详情抽屉（PV/会话聚合）均有数据。
 *
 * 用法：
 *   pnpm --filter @tzj/api exec tsx scripts/seed-visitors-mock.ts            # 追加一批 mock 访客
 *   pnpm --filter @tzj/api exec tsx scripts/seed-visitors-mock.ts --clear    # 先清除旧 mock 数据再灌入
 *   pnpm --filter @tzj/api exec tsx scripts/seed-visitors-mock.ts --only-clear# 仅清除 mock 数据
 *   pnpm --filter @tzj/api exec tsx scripts/seed-visitors-mock.ts --count=40
 *
 * 安全：所有 mock 访客的 anonymousId 统一以 "mock-vid-" 前缀标记，对应 PageView
 *       的 visitorId 同前缀；--clear 只删除这些行，绝不触碰真实埋点数据。生产环境请勿运行。
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** mock 访客统一 ID 前缀，供安全清理（deleteMany startsWith）。 */
export const MOCK_VID_PREFIX = 'mock-vid-';

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
const COUNT = getNum('count', 24);

// ---- 随机工具 ----
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}
function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function maybe<T>(value: T, prob: number): T | null {
  return Math.random() < prob ? value : null;
}

// ---- 数据池（消防训练塔 / 应急救援装备行业） ----
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
  '朱',
];
const GIVEN = ['伟', '芳', '强', '磊', '军', '洋', '勇', '艳', '杰', '涛', '明', '超', '娜', '静'];
const COMPANIES = [
  '河南应急消防装备有限公司',
  '山东蓝盾安全科技有限公司',
  '江苏华安消防工程有限公司',
  '广东南方应急救援装备制造',
  '陕西长安消防器材有限公司',
  '浙江之江消防科技股份',
  '福建海峡消防训练基地',
  '辽宁北方应急救援学院',
];

/** 地域池：[country, region(省), city] + 运营商，用于 PageView 地理列。 */
const GEO: ReadonlyArray<readonly [string, string, string]> = [
  ['中国', '广东省', '深圳市'],
  ['中国', '北京市', '北京市'],
  ['中国', '上海市', '上海市'],
  ['中国', '江苏省', '南京市'],
  ['中国', '浙江省', '杭州市'],
  ['中国', '四川省', '成都市'],
  ['中国', '山东省', '济南市'],
  ['中国', '河南省', '郑州市'],
  ['中国', '湖北省', '武汉市'],
  ['中国', '陕西省', '西安市'],
];

/** 设备组合：deviceType / vendor / model / os / osVersion / browser / browserVersion / clientApp。 */
interface DeviceProfile {
  deviceType: string;
  deviceVendor: string | null;
  deviceModel: string | null;
  os: string;
  osVersion: string;
  browser: string;
  browserVersion: string;
  clientApp: string | null;
  uaTemplate: string;
}
const DEVICES: readonly DeviceProfile[] = [
  {
    deviceType: 'desktop',
    deviceVendor: null,
    deviceModel: null,
    os: 'Windows',
    osVersion: '10',
    browser: 'Chrome',
    browserVersion: '126.0.0.0',
    clientApp: null,
    uaTemplate: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36',
  },
  {
    deviceType: 'desktop',
    deviceVendor: 'Apple',
    deviceModel: 'Macintosh',
    os: 'macOS',
    osVersion: '14.5',
    browser: 'Safari',
    browserVersion: '17.5',
    clientApp: null,
    uaTemplate: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.5 Safari/605.1.15',
  },
  {
    deviceType: 'desktop',
    deviceVendor: null,
    deviceModel: null,
    os: 'Windows',
    osVersion: '11',
    browser: 'Edge',
    browserVersion: '126.0.0.0',
    clientApp: null,
    uaTemplate: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/126.0.0.0',
  },
  {
    deviceType: 'mobile',
    deviceVendor: 'Apple',
    deviceModel: 'iPhone',
    os: 'iOS',
    osVersion: '17.5',
    browser: 'Safari',
    browserVersion: '17.5',
    clientApp: null,
    uaTemplate: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Version/17.5 Mobile Safari',
  },
  {
    deviceType: 'mobile',
    deviceVendor: 'Huawei',
    deviceModel: 'Mate 60',
    os: 'Android',
    osVersion: '13',
    browser: 'WeChat',
    browserVersion: '8.0.49',
    clientApp: '微信',
    uaTemplate: 'Mozilla/5.0 (Linux; Android 13) MicroMessenger/8.0.49 MMWEBID',
  },
  {
    deviceType: 'mobile',
    deviceVendor: 'Xiaomi',
    deviceModel: 'Redmi K60',
    os: 'Android',
    osVersion: '14',
    browser: 'Chrome',
    browserVersion: '125.0.0.0',
    clientApp: null,
    uaTemplate: 'Mozilla/5.0 (Linux; Android 14; Redmi K60) Chrome/125.0.0.0 Mobile',
  },
  {
    deviceType: 'tablet',
    deviceVendor: 'Apple',
    deviceModel: 'iPad',
    os: 'iPadOS',
    osVersion: '17.5',
    browser: 'Safari',
    browserVersion: '17.5',
    clientApp: null,
    uaTemplate: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) Version/17.5 Safari',
  },
  {
    deviceType: 'mobile',
    deviceVendor: 'OPPO',
    deviceModel: 'Find X7',
    os: 'Android',
    osVersion: '14',
    browser: 'Douyin',
    browserVersion: '27.5.0',
    clientApp: '抖音',
    uaTemplate: 'Mozilla/5.0 (Linux; Android 14) aweme/27.5.0',
  },
];

/** 站内路径池（含标题）。 */
const PATHS: ReadonlyArray<readonly [string, string]> = [
  ['/', '首页 - 天正杰应急救援训练装备'],
  ['/products', '产品中心'],
  ['/products/training-tower', '模拟训练塔'],
  ['/products/smoke-room', '模拟烟热训练室'],
  ['/cases', '工程案例'],
  ['/cases/fire-academy', '某消防培训学院综合训练场'],
  ['/news', '新闻资讯'],
  ['/about', '关于我们'],
  ['/contact', '联系我们'],
  ['/blog', '技术博客'],
];

/** 流量来源 + 对应 referrer / UTM。 */
interface TrafficProfile {
  trafficSource: string;
  referrer: string | null;
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  gclid: string | null;
}
const TRAFFICS: readonly TrafficProfile[] = [
  {
    trafficSource: 'direct',
    referrer: null,
    referrerHost: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    gclid: null,
  },
  {
    trafficSource: 'organic',
    referrer: 'https://www.baidu.com/',
    referrerHost: 'www.baidu.com',
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    gclid: null,
  },
  {
    trafficSource: 'paid',
    referrer: 'https://www.google.com/',
    referrerHost: 'www.google.com',
    utmSource: 'google',
    utmMedium: 'cpc',
    utmCampaign: 'training-tower-2026',
    gclid: `gclid-${Math.random().toString(36).slice(2, 12)}`,
  },
  {
    trafficSource: 'social',
    referrer: 'https://weixin.qq.com/',
    referrerHost: 'weixin.qq.com',
    utmSource: 'wechat',
    utmMedium: 'social',
    utmCampaign: 'moments-ad',
    gclid: null,
  },
  {
    trafficSource: 'referral',
    referrer: 'https://www.19lou.com/',
    referrerHost: 'www.19lou.com',
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    gclid: null,
  },
];

const DAY_MS = 86_400_000;

function maskIp(ip: string): string {
  const parts = ip.split('.');
  return `${parts[0]}.${parts[1]}.*.*`;
}
function fakeIp(): string {
  return `${randInt(36, 223)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;
}
function hex(len: number): string {
  let s = '';
  while (s.length < len) s += Math.random().toString(16).slice(2);
  return s.slice(0, len);
}

interface BuiltVisitor {
  visitor: {
    anonymousId: string;
    email: string | null;
    name: string | null;
    phone: string | null;
    company: string | null;
    traits: Record<string, unknown>;
    firstSeenAt: Date;
    lastSeenAt: Date;
    identifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
  pageViews: Array<Record<string, unknown>>;
}

function buildVisitor(idx: number): BuiltVisitor {
  const anonymousId = `${MOCK_VID_PREFIX}${Date.now().toString(36)}-${idx}-${hex(6)}`;
  const device = pick(DEVICES);
  const [country, region, city] = pick(GEO);
  const traffic = pick(TRAFFICS);
  const ip = fakeIp();
  const ipMasked = maskIp(ip);

  // 活跃窗口：最近 40 天内的某一段
  const firstDaysAgo = randInt(3, 40);
  const spanDays = randInt(0, firstDaysAgo);
  const firstSeenAt = new Date(Date.now() - firstDaysAgo * DAY_MS - randInt(0, 86_399) * 1000);
  const lastSeenAt = new Date(
    firstSeenAt.getTime() + spanDays * DAY_MS + randInt(0, 86_399) * 1000,
  );

  // 约 45% 已识别（提交过询盘 / identify）
  const identified = Math.random() < 0.45;
  const name = identified ? `${pick(SURNAMES)}${pick(GIVEN)}` : null;
  const company = identified ? maybe(pick(COMPANIES), 0.8) : null;
  const email = identified
    ? `visitor${randInt(1000, 9999)}@${pick(['163.com', 'qq.com', '126.com'])}`
    : null;
  const phone = identified
    ? `1${pick(['3', '5', '7', '8'])}${String(randInt(0, 999999999)).padStart(9, '0')}`
    : null;
  const landingPath = pick(PATHS)[0];

  // 会话与埋点：1~4 个会话，每会话 1~6 次 PV
  const sessionCount = randInt(1, 4);
  const pageViews: Array<Record<string, unknown>> = [];
  for (let s = 0; s < sessionCount; s++) {
    const sessionId = `mock-sess-${anonymousId}-${s}`;
    const pvCount = randInt(1, 6);
    // 会话发生时间点（落在活跃窗口内）
    const sessionAt = new Date(
      firstSeenAt.getTime() +
        randInt(0, Math.max(1, spanDays)) * DAY_MS +
        randInt(0, 86_399) * 1000,
    );
    for (let p = 0; p < pvCount; p++) {
      const [path, title] = pick(PATHS);
      pageViews.push({
        visitorId: anonymousId,
        sessionId,
        userId: null,
        path,
        title,
        referrer: p === 0 ? traffic.referrer : null,
        referrerHost: p === 0 ? traffic.referrerHost : null,
        userAgent: device.uaTemplate,
        ipHash: hex(64),
        ip,
        ipMasked,
        country,
        region,
        city,
        geoSource: 'mock',
        deviceType: device.deviceType,
        deviceModel: device.deviceModel,
        deviceVendor: device.deviceVendor,
        browser: device.browser,
        browserVersion: device.browserVersion,
        os: device.os,
        osVersion: device.osVersion,
        clientApp: device.clientApp,
        utmSource: traffic.utmSource,
        utmMedium: traffic.utmMedium,
        utmCampaign: traffic.utmCampaign,
        utmContent: null,
        utmTerm: null,
        gclid: traffic.gclid,
        trafficSource: traffic.trafficSource,
        isBot: false,
        createdAt: new Date(sessionAt.getTime() + p * randInt(20, 180) * 1000),
      });
    }
  }

  return {
    visitor: {
      anonymousId,
      email,
      name,
      phone,
      company,
      traits: {
        mock: true,
        landingPath,
        trafficSource: traffic.trafficSource,
        utmCampaign: traffic.utmCampaign,
        firstDevice: device.deviceType,
      },
      firstSeenAt,
      lastSeenAt,
      identifiedAt: identified
        ? new Date(firstSeenAt.getTime() + randInt(0, spanDays) * DAY_MS)
        : null,
      createdAt: firstSeenAt,
      updatedAt: lastSeenAt,
    },
    pageViews,
  };
}

async function clearMock(): Promise<void> {
  const pv = await prisma.pageView.deleteMany({
    where: { visitorId: { startsWith: MOCK_VID_PREFIX } },
  });
  const vs = await prisma.visitor.deleteMany({
    where: { anonymousId: { startsWith: MOCK_VID_PREFIX } },
  });
  console.log(
    `🧹 已清除 ${vs.count} 位 mock 访客 + ${pv.count} 条 mock 埋点（前缀 "${MOCK_VID_PREFIX}"）`,
  );
}

async function main(): Promise<void> {
  console.log('⚠️  开发专用假数据脚本（DEV ONLY）— 访客中心');

  if (DO_CLEAR) await clearMock();
  if (ONLY_CLEAR) {
    console.log('✅ 仅清除完成');
    return;
  }

  const built = Array.from({ length: COUNT }, (_, i) => buildVisitor(i));
  let pvTotal = 0;
  let identifiedTotal = 0;
  for (const b of built) {
    await prisma.visitor.create({ data: b.visitor as never });
    if (b.pageViews.length > 0) {
      await prisma.pageView.createMany({ data: b.pageViews as never });
      pvTotal += b.pageViews.length;
    }
    if (b.visitor.identifiedAt) identifiedTotal++;
  }

  console.log(
    `✅ 已插入 ${built.length} 位 mock 访客（${identifiedTotal} 位已识别）+ ${pvTotal} 条埋点 PageView`,
  );
  console.log('👉 访客中心 http://localhost:3002/visitors');
}

main()
  .catch((e) => {
    console.error('❌ 造数失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
