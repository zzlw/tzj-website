/**
 * 开发专用：客户管理（CRM 私海/公海）假数据脚本（DEV ONLY）。
 *
 * 用途：为 admin「客户管理」页灌入演示数据 —— 生成一批客户线索（Customer），
 *   覆盖公海（未分配）/ 私海（归属坐席）、多客户类型/来源/等级/阶段、预估金额、
 *   地域、标签、跟进时间，部分线索回链到 mock 访客（visitorId）与 mock 会话
 *   （chatRoomId），演示「访客/会话 → 客户」转化溯源与跨模块跳转。
 *
 * 用法：
 *   pnpm --filter @tzj/api exec tsx scripts/seed-customers-mock.ts            # 追加一批 mock 客户
 *   pnpm --filter @tzj/api exec tsx scripts/seed-customers-mock.ts --clear    # 先清除旧 mock 客户再灌入
 *   pnpm --filter @tzj/api exec tsx scripts/seed-customers-mock.ts --only-clear# 仅清除 mock 客户
 *   pnpm --filter @tzj/api exec tsx scripts/seed-customers-mock.ts --count=40
 *
 * 安全：所有 mock 客户的 tags 均含哨兵标签 "__mock__"；--clear 只删除含该标签的行，
 *       绝不触碰真实客户。生产环境请勿运行。
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** mock 客户哨兵标签，供安全清理（deleteMany where tags has）。 */
export const MOCK_TAG = '__mock__';
const MOCK_VID_PREFIX = 'mock-vid-';
const MOCK_ROOM_PREFIX = 'MOCK-';

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
const COUNT = getNum('count', 30);

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
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
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
const TITLES = [
  '采购经理',
  '装备科科长',
  '训练处主任',
  '后勤保障部部长',
  '项目负责人',
  '总务主管',
  '安全总监',
];
const COMPANIES = [
  '河南应急消防装备有限公司',
  '山东蓝盾安全科技有限公司',
  '江苏华安消防工程有限公司',
  '广东南方应急救援装备制造',
  '四川川消防训练设施有限公司',
  '陕西长安消防器材有限公司',
  '湖北楚天安全设备有限公司',
  '浙江之江消防科技股份',
  '安徽江淮应急产业集团',
  '福建海峡消防训练基地',
  '辽宁北方应急救援学院',
  '甘肃陇原消防设施工程',
];
const REGIONS = [
  '广东',
  '北京',
  '上海',
  '江苏',
  '浙江',
  '四川',
  '山东',
  '河南',
  '湖北',
  '陕西',
  '辽宁',
  '福建',
];
const ADDRESSES = [
  '经济技术开发区消防大道 18 号',
  '高新区安全产业园 A 座',
  '城东训练基地综合楼',
  '工业园区应急装备产业带',
];

// 与 schema 注释对齐的枚举值
const CUSTOMER_TYPES = [
  'fire',
  'armed-police',
  'military',
  'scenic',
  'school',
  'enterprise',
  'government',
  'other',
] as const;
const SOURCES = ['website', 'exhibition', 'referral', 'cold-call', 'existing', 'other'] as const;
const LEVELS = ['A', 'B', 'C'] as const;
const STAGES = ['new', 'following', 'intent', 'deal', 'lost'] as const;

const TAGS_POOL = [
  '重点跟进',
  '预算充足',
  '年内采购',
  '需招标',
  '老客户',
  '方案已发',
  '待回访',
  '价格敏感',
];
const NOTES_POOL = [
  '客户计划年内在训练基地新建一座四层训练塔，预算约 200 万，意向明确。',
  '地级市消防救援支队，需正规资质与验收报告，正在比选阶段。',
  '培训学院综合训练场项目，含训练塔、障碍跑道、破拆区，已发整体方案。',
  '现有训练塔使用多年需改造加固，咨询年度维保服务。',
  '需要模块化可拆装训练塔用于多地巡回培训，关注运输安装方案。',
  '企业专职消防队，场地有限，倾向紧凑型训练塔。',
];
const OPERATORS = ['超级管理员', '市场部-王经理', '售前-李工', '客服-小张'];

const DAY_MS = 86_400_000;

interface AgentRef {
  id: string;
  nickname: string | null;
  username: string;
}

function buildCustomer(
  agent: AgentRef | null,
  visitorId: string | null,
  chatRoomId: string | null,
): Record<string, unknown> {
  const name = `${pick(SURNAMES)}${pick(GIVEN)}`;
  const stage = pick(STAGES);
  const level = pick(LEVELS);
  // 约 55% 私海（归属坐席），其余公海（ownerId 空）
  const isPrivate = agent !== null && Math.random() < 0.55;
  const ownerId = isPrivate ? agent.id : null;

  const daysAgo = randInt(0, 60);
  const createdAt = new Date(Date.now() - daysAgo * DAY_MS - randInt(0, 86_399) * 1000);
  const lastContactAt = maybe(
    new Date(createdAt.getTime() + randInt(0, daysAgo) * DAY_MS),
    stage === 'new' ? 0.3 : 0.85,
  );
  const nextFollowAt =
    stage === 'deal' || stage === 'lost'
      ? null
      : maybe(new Date(Date.now() + randInt(1, 14) * DAY_MS), 0.7);

  // 金额：越靠后阶段越可能有预估金额
  const hasAmount = stage === 'intent' || stage === 'deal' || Math.random() < 0.4;
  const amount = hasAmount ? randInt(20, 500) * 10_000 : null;

  const tags = [MOCK_TAG, ...shuffle(TAGS_POOL).slice(0, randInt(0, 3))];
  const operatorName = agent?.nickname ?? pick(OPERATORS);

  return {
    name,
    company: maybe(pick(COMPANIES), 0.85),
    title: maybe(pick(TITLES), 0.7),
    phone: maybe(
      `1${pick(['3', '5', '7', '8'])}${String(randInt(0, 999999999)).padStart(9, '0')}`,
      0.9,
    ),
    email: maybe(`crm${randInt(1000, 9999)}@${pick(['163.com', 'qq.com', '126.com'])}`, 0.6),
    customerType: pick(CUSTOMER_TYPES),
    source: pick(SOURCES),
    level,
    stage,
    amount,
    region: maybe(pick(REGIONS), 0.85),
    address: maybe(pick(ADDRESSES), 0.4),
    tags,
    notes: maybe(pick(NOTES_POOL), 0.75),
    chatRoomId,
    contactId: null,
    visitorId,
    ownerId,
    lastContactAt,
    nextFollowAt,
    lastOperator: operatorName,
    lastOperatorId: agent?.id ?? null,
    createdBy: operatorName,
    createdById: agent?.id ?? null,
    createdAt,
    updatedAt: lastContactAt ?? createdAt,
  };
}

async function clearMock(): Promise<void> {
  const res = await prisma.customer.deleteMany({ where: { tags: { has: MOCK_TAG } } });
  console.log(`🧹 已清除 ${res.count} 位 mock 客户（含标签 "${MOCK_TAG}"）`);
}

async function main(): Promise<void> {
  console.log('⚠️  开发专用假数据脚本（DEV ONLY）— 客户管理');

  if (DO_CLEAR) await clearMock();
  if (ONLY_CLEAR) {
    console.log('✅ 仅清除完成');
    return;
  }

  // 归属坐席：取任一 admin/editor 用户
  const agent = await prisma.user.findFirst({
    where: { isActive: true },
    select: { id: true, nickname: true, username: true },
  });

  // 可关联的 mock 访客（visitorId，可复用）
  const mockVisitors = await prisma.visitor.findMany({
    where: { anonymousId: { startsWith: MOCK_VID_PREFIX } },
    select: { anonymousId: true },
    take: 200,
  });
  const vids = mockVisitors.map((v) => v.anonymousId);

  // 可关联的 mock 会话（chatRoomId 唯一，需去重分配；排除已被占用的）
  const mockRooms = await prisma.chatRoom.findMany({
    where: { roomId: { startsWith: MOCK_ROOM_PREFIX }, customerId: null },
    select: { roomId: true },
    take: 200,
  });
  const usedRooms = new Set(
    (
      await prisma.customer.findMany({
        where: { chatRoomId: { not: null } },
        select: { chatRoomId: true },
      })
    )
      .map((c) => c.chatRoomId)
      .filter((r): r is string => !!r),
  );
  const availRooms = shuffle(mockRooms.map((r) => r.roomId).filter((r) => !usedRooms.has(r)));

  let privateCount = 0;
  let publicCount = 0;
  let linkedVisitor = 0;
  let linkedRoom = 0;
  let roomCursor = 0;

  for (let i = 0; i < COUNT; i++) {
    const visitorId = vids.length > 0 && Math.random() < 0.4 ? pick(vids) : null;
    // 约 25% 客户绑定一个唯一 mock 会话（来源溯源）
    let chatRoomId: string | null = null;
    if (roomCursor < availRooms.length && Math.random() < 0.25) {
      chatRoomId = availRooms[roomCursor++]!;
    }

    const data = buildCustomer(agent, visitorId, chatRoomId);
    await prisma.customer.create({ data: data as never });

    if (data.ownerId) privateCount++;
    else publicCount++;
    if (visitorId) linkedVisitor++;
    if (chatRoomId) linkedRoom++;
  }

  console.log(`✅ 已插入 ${COUNT} 位 mock 客户（私海 ${privateCount} / 公海 ${publicCount}）`);
  console.log(`   回链：${linkedVisitor} 位关联访客，${linkedRoom} 位关联会话`);
  if (!agent) console.log('   ⚠️ 未找到用户，私海归属为空（全部落入公海）');
  console.log('👉 客户管理 http://localhost:3002/customers');
}

main()
  .catch((e) => {
    console.error('❌ 造数失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
