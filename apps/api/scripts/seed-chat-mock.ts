/**
 * 开发专用：在线客服会话假数据脚本（DEV ONLY）。
 *
 * 用途：为 admin「在线客服 / 会话」页灌入演示数据 —— 生成一批聊天室（ChatRoom）
 *   及其消息（ChatMessage），覆盖等待/进行中/已关闭/已归档四种状态、含访客画像
 *   （脱敏 IP、地域、设备、浏览器、来源），消息在 client/agent 间往返并含系统消息，
 *   使会话列表、未读计数、状态分桶、消息检索与会话详情均有数据。
 *
 * 用法：
 *   pnpm --filter @tzj/api exec tsx scripts/seed-chat-mock.ts            # 追加一批 mock 会话
 *   pnpm --filter @tzj/api exec tsx scripts/seed-chat-mock.ts --clear    # 先清除旧 mock 会话再灌入
 *   pnpm --filter @tzj/api exec tsx scripts/seed-chat-mock.ts --only-clear# 仅清除 mock 会话
 *   pnpm --filter @tzj/api exec tsx scripts/seed-chat-mock.ts --count=20
 *
 * 安全：所有 mock 会话的 roomId 统一以 "MOCK-" 前缀标记；--clear 只删除这些行
 *       （消息随房间级联删除），绝不触碰真实会话。生产环境请勿运行。
 *   若本地已存在 mock 访客（scripts/seed-visitors-mock.ts），部分会话会自动
 *   把 visitorId 关联到这些访客，打通「会话 ↔ 访客」跨模块跳转。
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** mock 会话统一 roomId 前缀，供安全清理（deleteMany startsWith）。 */
export const MOCK_ROOM_PREFIX = 'MOCK-';
/** 与 seed-visitors-mock.ts 保持一致的访客前缀，用于关联。 */
const MOCK_VID_PREFIX = 'mock-vid-';
/** 坐席账号（与 prisma/seed.ts 默认管理员一致）。 */
const AGENT_EMAIL = 'admin@example.com';
const AGENT_NAME = '超级管理员';

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
const COUNT = getNum('count', 16);

// ---- 随机工具 ----
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// ---- 数据池 ----
const SURNAMES = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙'];
const GIVEN = ['伟', '芳', '强', '磊', '军', '洋', '勇', '艳', '杰', '涛', '明', '超'];
const GEO: ReadonlyArray<readonly [string, string, string]> = [
  ['中国', '广东省', '深圳市'],
  ['中国', '北京市', '北京市'],
  ['中国', '江苏省', '南京市'],
  ['中国', '四川省', '成都市'],
  ['中国', '山东省', '济南市'],
  ['中国', '河南省', '郑州市'],
];
const DEVICES = [
  {
    deviceType: 'desktop',
    browser: 'Chrome',
    browserVersion: '126.0.0.0',
    os: 'Windows',
    osVersion: '10',
    clientApp: null,
  },
  {
    deviceType: 'mobile',
    browser: 'WeChat',
    browserVersion: '8.0.49',
    os: 'Android',
    osVersion: '13',
    clientApp: '微信',
  },
  {
    deviceType: 'mobile',
    browser: 'Safari',
    browserVersion: '17.5',
    os: 'iOS',
    osVersion: '17.5',
    clientApp: null,
  },
  {
    deviceType: 'desktop',
    browser: 'Edge',
    browserVersion: '126.0.0.0',
    os: 'Windows',
    osVersion: '11',
    clientApp: null,
  },
];
const LANDING = ['/products/training-tower', '/cases', '/contact', '/products/smoke-room', '/'];

/** 访客首问池。 */
const CLIENT_OPENERS = [
  '你好，想咨询一下四层模拟训练塔的价格和尺寸参数。',
  '请问模拟烟热训练室支持定制吗？我们场地比较小。',
  '我们是消防救援支队，想了解整套训练场的建设方案。',
  '训练塔的交付周期大概多久？年内能装好吗？',
  '想要一份产品资料和过往案例，麻烦发一下。',
  '模块化训练塔可以拆装转场吗？运输方便吗？',
];
const CLIENT_FOLLOWS = [
  '预算大概在两百万左右，能做到吗？',
  '能提供正规资质和验收报告吗？',
  '我在广东，能安排上门勘察吗？',
  '好的，那你把报价单发到我邮箱吧。',
  '还有防坠落系统的检测证书能一起给吗？',
  '大概什么时候能出方案？',
];
const AGENT_REPLIES = [
  '您好！四层训练塔标准款高约 12 米，承重按国标设计，我这边发一份参数表给您。',
  '可以定制的，我们支持按场地尺寸出图，稍后安排工程师和您对接。',
  '整体方案我们可以做，包含训练塔、破拆区、障碍跑道，报价我整理后发您。',
  '标准款交付约 45–60 天，含生产、运输和安装，年内没问题。',
  '资料和案例这就发您，方便留个邮箱或微信吗？',
  '模块化款支持快速拆装，配套运输方案，多地巡回培训很合适。',
];
const AGENT_NOTES = [
  '客户预算充足，意向明确，已转销售跟进。',
  '需求较大，已安排出整体方案。',
  '比选阶段，报价已发送。',
  '老客户复购，优先处理。',
];

const STATUSES = ['waiting', 'active', 'closed', 'archived'] as const;
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

interface BuiltMessage {
  messageId: string;
  content: string;
  sender: 'client' | 'agent' | 'system';
  senderEmail: string | null;
  timestamp: Date;
  isRead: boolean;
}

function buildMessages(startAt: Date, status: string): BuiltMessage[] {
  const msgs: BuiltMessage[] = [];
  let t = startAt.getTime();
  const step = () => {
    t += randInt(30, 600) * 1000;
    return new Date(t);
  };
  // 系统开场
  msgs.push({
    messageId: `mock-msg-${hex(10)}`,
    content: '访客已接入，正在为您分配客服…',
    sender: 'system',
    senderEmail: null,
    timestamp: new Date(t),
    isRead: true,
  });
  // 首问
  msgs.push({
    messageId: `mock-msg-${hex(10)}`,
    content: pick(CLIENT_OPENERS),
    sender: 'client',
    senderEmail: null,
    timestamp: step(),
    isRead: status !== 'waiting',
  });
  // waiting 状态：只有访客首问、尚无坐席应答
  if (status === 'waiting') return msgs;

  const rounds = randInt(1, 4);
  for (let r = 0; r < rounds; r++) {
    msgs.push({
      messageId: `mock-msg-${hex(10)}`,
      content: pick(AGENT_REPLIES),
      sender: 'agent',
      senderEmail: AGENT_EMAIL,
      timestamp: step(),
      isRead: true,
    });
    if (Math.random() < 0.8) {
      msgs.push({
        messageId: `mock-msg-${hex(10)}`,
        content: pick(CLIENT_FOLLOWS),
        sender: 'client',
        senderEmail: null,
        timestamp: step(),
        isRead: status !== 'active' || Math.random() < 0.6,
      });
    }
  }
  return msgs;
}

interface BuiltRoom {
  room: Record<string, unknown>;
  messages: BuiltMessage[];
}

function buildRoom(idx: number, status: string, visitorId: string | null): BuiltRoom {
  const roomId = `${MOCK_ROOM_PREFIX}${Date.now().toString(36)}-${idx}-${hex(4)}`;
  const clientName = `${pick(SURNAMES)}${pick(GIVEN)}`;
  const clientEmail = `guest${randInt(1000, 9999)}@${pick(['163.com', 'qq.com', '126.com'])}`;
  const device = pick(DEVICES);
  const [country, region, city] = pick(GEO);
  const ip = fakeIp();

  const daysAgo = randInt(0, 30);
  // waiting 会话须新鲜（lastActivity < CHAT_IDLE_CLOSE_HOURS，默认 24h），否则会被网关
  // autoMaintain @Interval 任务判定为闲置并自动关闭——模拟「刚进线、尚未被坐席接起」。
  const createdAt =
    status === 'waiting'
      ? new Date(Date.now() - randInt(1, 300) * 60_000)
      : new Date(Date.now() - daysAgo * DAY_MS - randInt(0, 86_399) * 1000);
  const messages = buildMessages(createdAt, status);
  const lastMsg = messages[messages.length - 1];
  const lastActivity = lastMsg.timestamp;

  const unreadForAgent = messages.filter((m) => m.sender === 'client' && !m.isRead).length;
  const isClosed = status === 'closed' || status === 'archived';
  const closedAt = isClosed ? new Date(lastActivity.getTime() + randInt(1, 48) * 3_600_000) : null;
  const archivedAt =
    status === 'archived' ? new Date((closedAt as Date).getTime() + randInt(3, 15) * DAY_MS) : null;
  const assignedAgentEmail = status === 'waiting' ? null : AGENT_EMAIL;

  return {
    room: {
      roomId,
      clientEmail,
      clientName,
      status,
      assignedAgentEmail,
      lastActivity,
      closedAt,
      closedBy: isClosed ? AGENT_NAME : null,
      tags: [],
      notes: isClosed ? pick(AGENT_NOTES) : null,
      unreadCountForClient: 0,
      unreadCountForAgent: unreadForAgent,
      lastReadByAgent:
        status === 'active' ? new Date(lastActivity.getTime() - 3_600_000) : lastActivity,
      lastReadByClient: lastActivity,
      archivedAt,
      customerId: null,
      visitorId,
      clientIp: ip,
      ipMasked: maskIp(ip),
      country,
      region,
      city,
      deviceType: device.deviceType,
      browser: device.browser,
      browserVersion: device.browserVersion,
      os: device.os,
      osVersion: device.osVersion,
      clientApp: device.clientApp,
      referrer: 'https://www.baidu.com/',
      referrerHost: 'www.baidu.com',
      userAgent: `Mozilla/5.0 mock ${device.browser}`,
      landingPath: pick(LANDING),
      source: pick(['organic', 'direct', 'paid', 'social']),
      createdAt,
      updatedAt: lastActivity,
    },
    messages,
  };
}

async function clearMock(): Promise<void> {
  // 消息随房间 onDelete: Cascade 级联删除，只需删房间
  const res = await prisma.chatRoom.deleteMany({
    where: { roomId: { startsWith: MOCK_ROOM_PREFIX } },
  });
  console.log(`🧹 已清除 ${res.count} 个 mock 会话（前缀 "${MOCK_ROOM_PREFIX}"，消息级联删除）`);
}

async function main(): Promise<void> {
  console.log('⚠️  开发专用假数据脚本（DEV ONLY）— 在线客服会话');

  if (DO_CLEAR) await clearMock();
  if (ONLY_CLEAR) {
    console.log('✅ 仅清除完成');
    return;
  }

  // 尝试关联已有 mock 访客（打通会话 ↔ 访客跳转）
  const mockVisitors = await prisma.visitor.findMany({
    where: { anonymousId: { startsWith: MOCK_VID_PREFIX } },
    select: { anonymousId: true },
    take: 100,
  });
  const vids = mockVisitors.map((v) => v.anonymousId);

  let msgTotal = 0;
  const statusTally: Record<string, number> = {};
  for (let i = 0; i < COUNT; i++) {
    // 状态分布：waiting 少、active/closed 多、archived 少
    const status = pick([...STATUSES, 'active', 'closed', 'active', 'closed']);
    const visitorId = vids.length > 0 && Math.random() < 0.6 ? pick(vids) : null;
    const built = buildRoom(i, status, visitorId);
    const created = await prisma.chatRoom.create({ data: built.room as never });
    await prisma.chatMessage.createMany({
      data: built.messages.map((m) => ({ ...m, chatRoomId: created.id })) as never,
    });
    msgTotal += built.messages.length;
    statusTally[status] = (statusTally[status] ?? 0) + 1;
  }

  console.log(`✅ 已插入 ${COUNT} 个 mock 会话 + ${msgTotal} 条消息`);
  console.log(
    `   状态分布：${Object.entries(statusTally)
      .map(([k, v]) => `${k}=${v}`)
      .join('，')}`,
  );
  if (vids.length > 0)
    console.log(`   已关联 ${vids.length} 位 mock 访客（部分会话可跳转访客抽屉）`);
  else console.log('   （未发现 mock 访客，visitorId 留空；如需联动请先跑 seed-visitors-mock.ts）');
  console.log('👉 在线客服 http://localhost:3002/chat');
}

main()
  .catch((e) => {
    console.error('❌ 造数失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
