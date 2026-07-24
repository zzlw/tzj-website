/**
 * 开发专用：询盘管理假数据脚本（DEV ONLY）。
 *
 * 用途：为 admin「询盘管理」页快速灌入演示数据，覆盖不同状态
 *   （未读/已读、待处理/已处理）、多来源、多行业主题与真实感中文留言，
 *   并将创建时间分散到最近若干天，便于查看列表 / 排序 / 处理流程。
 *
 * 用法：
 *   pnpm --filter @tzj/api exec tsx scripts/seed-contacts-mock.ts            # 追加一批 mock 询盘
 *   pnpm --filter @tzj/api exec tsx scripts/seed-contacts-mock.ts --clear    # 先清除旧 mock 数据再灌入
 *   pnpm --filter @tzj/api exec tsx scripts/seed-contacts-mock.ts --only-clear# 仅清除 mock 数据
 *   pnpm --filter @tzj/api exec tsx scripts/seed-contacts-mock.ts --count=40
 *
 * 安全：所有 mock 询盘统一以 source = "mock" 标记，--clear 只删除这些行，
 *       绝不触碰官网真实提交（source = website / admin / api）。生产环境请勿运行。
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MOCK_SOURCE = 'mock';

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
const COUNT = getNum('count', 32);

// ---- 随机工具 ----
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
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
  '胡',
];
const GIVEN = [
  '伟',
  '芳',
  '强',
  '磊',
  '军',
  '洋',
  '勇',
  '艳',
  '杰',
  '涛',
  '明',
  '超',
  '娜',
  '静',
  '敏',
  '斌',
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
  '河北燕赵安全工程有限公司',
  '云南高原消防装备有限公司',
  '辽宁北方应急救援学院',
  '甘肃陇原消防设施工程',
  '内蒙古草原应急保障中心',
];

const SUBJECTS = [
  '消防训练塔采购咨询',
  '模拟烟热训练室方案询价',
  '应急救援训练场整体设计',
  '训练塔年度维保合作',
  '定制化训练设施需求',
  '消防员体能训练器材采购',
  '模块化训练塔报价',
  '培训基地建设合作',
  '训练塔改造升级咨询',
  '灭火演练设施询盘',
];

const MESSAGES = [
  '贵司的四层模拟训练塔具体尺寸和承重参数能否发一份？我们计划年内在训练基地新建一座，预算约 200 万。',
  '想了解模拟烟热训练室的配置清单和交付周期，我们是地级市消防救援支队，需要正规资质与验收报告。',
  '我们培训学院要新建一个综合训练场，包含训练塔、障碍跑道、破拆训练区，希望能提供整体设计方案与报价。',
  '现有训练塔已使用 8 年，部分钢结构需要检测和加固，请问贵司是否提供年度维保和改造服务？',
  '需要一座可拆装、便于转场的模块化训练塔，用于多地巡回培训，麻烦发一下运输和安装方案。',
  '咨询消防员体能训练器材（负重爬梯、拖拽假人、翻轮胎等）的整套采购，数量约 30 套。',
  '我们是企业专职消防队，想采购小型训练塔用于日常演练，场地有限，希望有紧凑型方案。',
  '请问训练塔的防坠落系统和保护装置是否符合最新国家标准？需要提供检测证书。',
  '想合作共建一个区域性消防培训基地，贵司能否参与设施规划、施工和后期运营指导？',
  '灭火演练需要一套可控燃烧模拟装置（油盘火、气体火），咨询是否有成熟产品及安全认证。',
  '训练塔顶部速降和绳索救援训练区需要加装锚点，能否上门勘察并给出改造建议？',
  '预算有限，先了解基础款训练塔的最低配置和价格区间，后续再逐步升级。',
];

const REMARKS = [
  '已电话回访，客户预算充足，意向明确，已安排销售跟进。',
  '需求较大，已转市场部制作方案报价。',
  '客户处于比选阶段，报价已发送，待回复。',
  '已加微信，发送产品资料与案例。',
  '客户为老客户续单，优先处理。',
];

const OPERATORS = ['admin', '市场部-王经理', '售前-李工', '客服-小张'];

interface MockContact {
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  subject: string | null;
  message: string;
  source: string;
  isRead: boolean;
  isHandled: boolean;
  remark: string | null;
  lastOperator: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function buildContact(): MockContact {
  const name = `${pick(SURNAMES)}${pick(GIVEN)}`;
  const company = maybe(pick(COMPANIES), 0.85);
  // 时间：分散到最近 45 天内
  const daysAgo = randInt(0, 45);
  const createdAt = new Date(Date.now() - daysAgo * 86_400_000 - randInt(0, 86_399) * 1000);

  // 状态组合：越新越可能未读/未处理（贴近真实工单流转）
  const isHandled = daysAgo > 7 ? Math.random() < 0.7 : Math.random() < 0.25;
  const isRead = isHandled ? true : Math.random() < 0.5;
  const handledAt = isHandled
    ? new Date(createdAt.getTime() + randInt(1, 72) * 3_600_000)
    : createdAt;

  const phone = `1${pick(['3', '5', '7', '8', '9'])}${String(randInt(0, 9_9999_9999)).padStart(9, '0')}`;
  const emailUser = `kf${randInt(1000, 9999)}`;
  const email = maybe(`${emailUser}@${pick(['163.com', 'qq.com', '126.com', 'foxmail.com'])}`, 0.6);

  return {
    name,
    phone: maybe(phone, 0.9),
    email,
    company,
    subject: pick(SUBJECTS),
    message: pick(MESSAGES),
    source: MOCK_SOURCE,
    isRead,
    isHandled,
    remark: isHandled ? pick(REMARKS) : maybe(pick(REMARKS), 0.15),
    lastOperator: isHandled ? pick(OPERATORS) : null,
    createdAt,
    updatedAt: handledAt,
  };
}

async function clearMock(): Promise<void> {
  const res = await prisma.contact.deleteMany({ where: { source: MOCK_SOURCE } });
  console.log(`🧹 已清除 ${res.count} 条 mock 询盘（source = "${MOCK_SOURCE}"）`);
}

async function main(): Promise<void> {
  console.log('⚠️  开发专用假数据脚本（DEV ONLY）');

  if (DO_CLEAR) await clearMock();
  if (ONLY_CLEAR) {
    console.log('✅ 仅清除完成');
    return;
  }

  const rows = Array.from({ length: COUNT }, () => buildContact());
  const res = await prisma.contact.createMany({ data: rows });

  const handled = rows.filter((r) => r.isHandled).length;
  const unread = rows.filter((r) => !r.isRead).length;
  console.log(
    `✅ 已插入 ${res.count} 条 mock 询盘（${unread} 条未读，${handled} 条已处理，${res.count - handled} 条待处理）`,
  );
  console.log('👉 询盘管理 http://localhost:3002/contacts');
}

main()
  .catch((e) => {
    console.error('❌ 造数失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
