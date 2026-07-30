import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { AdSpendSummary } from '@tzj/types';
import { LAST_OPERATOR_USER_SELECT, mapOperatorUser } from '../common/utils/content-list';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { PrismaService } from '../prisma/prisma.service';
import { AdSpendService } from './ad-spend.service';

/**
 * 增长指标服务（转化率看板 Phase1-MVP）：
 * - 转化率核心指标（访客→询盘→客户，含付费渠道归因与询盘成本）
 * - 客服绩效指标（首响时长/会话转化率/坐席排行）
 * - 渠道四层漏斗（visitors → engaged → inquiries → customers）
 *
 * 设计约束（见 docs/analytics/conversion-metrics-dashboard-evaluation.md）：
 * 零新依赖；T+1 历史区间走进程内缓存（凌晨 2 点 Cron 预热默认区间），
 * 今日/跨今日区间实时计算；单实例部署重启后缓存为空，miss 回退实时计算并回填。
 */

interface DateRange {
  from: Date;
  to: Date;
}

/** 与 analytics.service 的 parseRange 同口径（本地时区整日），保证与访客分析页数字一致 */
function parseRange(from?: string, to?: string, defaultDays = 7): DateRange {
  const now = new Date();
  const toDate = to ? new Date(to) : now;
  const fromDate = from ? new Date(from) : new Date(now.getTime() - (defaultDays - 1) * 86400000);
  const start = new Date(Number.isNaN(fromDate.getTime()) ? now : fromDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(Number.isNaN(toDate.getTime()) ? now : toDate);
  end.setHours(23, 59, 59, 999);
  return { from: start, to: end };
}

/** 区间是否完全为历史日期（T+1 可缓存：今天 0 点前结束） */
function isHistoricalRange(range: DateRange): boolean {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return range.to.getTime() < todayStart.getTime();
}

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const CACHE_TTL_MS = 24 * 3600 * 1000;

export interface ConversionMetricsResponse {
  dateRange: { from: Date; to: Date };
  totalVisitors: number;
  convertedCustomers: number;
  conversionRate: number; // %
  adVisitors: number;
  adCustomers: number;
  adConversionRate: number; // %
  adInquiries: number;
  adSpend: number; // 元（台账按天分摊聚合的区间花费，docs/ad-spend-ledger-design.md §4）
  adSpendByPlatform: AdSpendSummary['byPlatform']; // 分平台区间花费
  inquiryCost: number; // 元/询盘
  metricsDate: string; // ISO 8601，计算时间标记
}

export interface SupportMetricsResponse {
  teamOverview: {
    totalRooms: number;
    convertedRooms: number;
    supportConversionRate: number; // %
    avgFirstResponseTime: number; // 分钟
  };
  agentRankings: Array<{
    maskedId: string;
    /** 坐席账号信息（供 B 端 hover 资料卡展示，复用 content 模块 OperatorUser 结构） */
    agentUser: ReturnType<typeof mapOperatorUser>;
    totalRooms: number;
    avgFirstResponseTime: number; // 分钟
    conversionRate: number; // %
  }>;
}

export interface ChannelFunnelRow {
  channel: string;
  funnel: { visitors: number; engaged: number; inquiries: number; customers: number };
  conversionRates: {
    visitToEngage: number;
    engageToInquiry: number;
    inquiryToCustomer: number;
    overall: number;
  };
}

@Injectable()
export class GrowthMetricsService {
  private readonly logger = new Logger(GrowthMetricsService.name);
  /** T+1 历史区间结果缓存：key = 指标名:fromISO|toISO */
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly adSpend: AdSpendService,
  ) {}

  // ── 转化率核心指标 ──────────────────────────────────────────────

  async getConversionMetrics(from?: string, to?: string): Promise<ConversionMetricsResponse> {
    const range = parseRange(from, to);
    const cached = this.readCache<ConversionMetricsResponse>('cm', range);
    if (cached) return cached;

    // 1. 总访客数（去重 visitorId，排除 bot）
    const totalVisitors = (
      await this.prisma.pageView.findMany({
        where: {
          createdAt: { gte: range.from, lte: range.to },
          isBot: false,
          visitorId: { not: null },
        },
        distinct: ['visitorId'],
        select: { visitorId: true },
      })
    ).length;

    // 2. 转化客户数（带 visitorId 归因的新建客户）
    const convertedCustomers = await this.prisma.customer.count({
      where: {
        visitorId: { not: null },
        createdAt: { gte: range.from, lte: range.to },
        deletedAt: null,
      },
    });

    const conversionRate = totalVisitors > 0 ? (convertedCustomers / totalVisitors) * 100 : 0;

    // 3. 付费渠道：先查访客 ID 集合，再关联计数（fetch → map → count 三步；
    //    小站量级下 where in 安全，超限时改单条 $queryRaw JOIN）
    const paidRows = await this.prisma.pageView.findMany({
      where: {
        createdAt: { gte: range.from, lte: range.to },
        isBot: false,
        trafficSource: 'paid',
        visitorId: { not: null },
      },
      distinct: ['visitorId'],
      select: { visitorId: true },
    });
    const paidVisitorIds = paidRows.map((r) => r.visitorId as string);
    const adVisitors = paidVisitorIds.length;

    const [adCustomers, adInquiries] = adVisitors
      ? await Promise.all([
          this.prisma.customer.count({
            where: {
              visitorId: { in: paidVisitorIds },
              createdAt: { gte: range.from, lte: range.to },
              deletedAt: null,
            },
          }),
          this.prisma.contact.count({
            where: {
              visitorId: { in: paidVisitorIds },
              createdAt: { gte: range.from, lte: range.to },
              deletedAt: null,
            },
          }),
        ])
      : [0, 0];

    const adConversionRate = adVisitors > 0 ? (adCustomers / adVisitors) * 100 : 0;

    // 4. 询盘成本（CAC 近似）：台账按天分摊聚合的区间花费，分子分母同口径
    const spendSummary = await this.adSpend.sumAdSpend(toYmd(range.from), toYmd(range.to));
    const inquiryCost = adInquiries > 0 ? spendSummary.total / adInquiries : 0;

    const result: ConversionMetricsResponse = {
      dateRange: { from: range.from, to: range.to },
      totalVisitors,
      convertedCustomers,
      conversionRate: round2(conversionRate),
      adVisitors,
      adCustomers,
      adConversionRate: round2(adConversionRate),
      adInquiries,
      adSpend: spendSummary.total,
      adSpendByPlatform: spendSummary.byPlatform,
      inquiryCost: round2(inquiryCost),
      metricsDate: new Date().toISOString(),
    };
    this.writeCache('cm', range, result);
    return result;
  }

  // ── 客服绩效指标 ────────────────────────────────────────────────

  async getSupportMetrics(from?: string, to?: string): Promise<SupportMetricsResponse> {
    const range = parseRange(from, to);
    const cached = this.readCache<SupportMetricsResponse>('sm', range);
    if (cached) return cached;

    const [totalRooms, convertedRooms] = await Promise.all([
      this.prisma.chatRoom.count({
        where: { createdAt: { gte: range.from, lte: range.to }, deletedAt: null },
      }),
      this.prisma.chatRoom.count({
        where: {
          createdAt: { gte: range.from, lte: range.to },
          deletedAt: null,
          customerId: { not: null },
        },
      }),
    ]);
    const supportConversionRate = totalRooms > 0 ? (convertedRooms / totalRooms) * 100 : 0;

    // 平均首响：首条坐席消息与建房时间差（LATERAL 天然排除无坐席消息的 waiting 会话，
    // 无幸存者偏差——closed 会话同样计入）
    const avgRows = await this.prisma.$queryRaw<Array<{ avg_minutes: number | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM (first_msg.timestamp - cr."createdAt")) / 60) AS avg_minutes
      FROM chat_rooms cr
      JOIN LATERAL (
        SELECT cm.timestamp
        FROM chat_messages cm
        WHERE cm."chatRoomId" = cr.id
          AND cm.sender = 'agent'
        ORDER BY cm.timestamp ASC
        LIMIT 1
      ) first_msg ON true
      WHERE cr."createdAt" BETWEEN ${range.from} AND ${range.to}
        AND cr."deletedAt" IS NULL
    `;
    const avgFirstResponseTime = Number(avgRows[0]?.avg_minutes ?? 0);

    // 坐席排行：按 senderEmail 聚合（sender='agent' 且 senderEmail 非空；访客消息无邮箱）。
    // maskedId 脱敏口径：邮箱本地部分末位字符，其余 ***（如 agent3@tzj.com → ***3），
    // 作为账号已删除等查不到 agentUser 时的兜底展示。
    const agentRows = await this.prisma.$queryRaw<
      Array<{
        agentEmail: string;
        totalRooms: bigint;
        avgMinutes: number | null;
        convertedRooms: bigint;
      }>
    >`
      SELECT
        a.agent_email AS "agentEmail",
        COUNT(*)::bigint AS "totalRooms",
        AVG(EXTRACT(EPOCH FROM (a.first_ts - cr."createdAt")) / 60) AS "avgMinutes",
        COUNT(*) FILTER (WHERE cr."customerId" IS NOT NULL)::bigint AS "convertedRooms"
      FROM (
        SELECT cm."chatRoomId" AS room_id, cm."senderEmail" AS agent_email,
               MIN(cm.timestamp) AS first_ts
        FROM chat_messages cm
        WHERE cm.sender = 'agent' AND cm."senderEmail" IS NOT NULL
        GROUP BY cm."chatRoomId", cm."senderEmail"
      ) a
      JOIN chat_rooms cr ON cr.id = a.room_id
      WHERE cr."createdAt" BETWEEN ${range.from} AND ${range.to}
        AND cr."deletedAt" IS NULL
      GROUP BY a.agent_email
      ORDER BY "totalRooms" DESC
      LIMIT 10
    `;

    // 批量查询坐席账号信息（B 端 hover 资料卡用），单次 IN 查询避免 N+1。
    // 坐席以 username=邮箱 登录，User.email 可能为空，须 OR 双字段匹配（同 chat-room.service）。
    const agentEmails = agentRows.map((r) => r.agentEmail);
    const agentUsers = agentEmails.length
      ? await this.prisma.user.findMany({
          where: {
            OR: [{ email: { in: agentEmails } }, { username: { in: agentEmails } }],
          },
          select: LAST_OPERATOR_USER_SELECT,
        })
      : [];
    const agentUserMap = new Map<string, (typeof agentUsers)[number]>();
    for (const u of agentUsers) {
      if (u.email) agentUserMap.set(u.email.toLowerCase(), u);
      agentUserMap.set(u.username.toLowerCase(), u);
    }

    const agentRankings = agentRows.map((r) => {
      const total = Number(r.totalRooms);
      const converted = Number(r.convertedRooms);
      return {
        maskedId: maskAgentEmail(r.agentEmail),
        agentUser: mapOperatorUser(agentUserMap.get(r.agentEmail.toLowerCase())),
        totalRooms: total,
        avgFirstResponseTime: round1(Number(r.avgMinutes ?? 0)),
        conversionRate: round2(total > 0 ? (converted / total) * 100 : 0),
      };
    });

    const result: SupportMetricsResponse = {
      teamOverview: {
        totalRooms,
        convertedRooms,
        supportConversionRate: round2(supportConversionRate),
        avgFirstResponseTime: round1(avgFirstResponseTime),
      },
      agentRankings,
    };
    this.writeCache('sm', range, result);
    return result;
  }

  // ── 渠道四层漏斗 ────────────────────────────────────────────────

  async getSourcesFunnel(from?: string, to?: string): Promise<ChannelFunnelRow[]> {
    const range = parseRange(from, to, 30);
    const cached = this.readCache<ChannelFunnelRow[]>('funnel', range);
    if (cached) return cached;

    // 渠道枚举：与现有 getSources 同口径（isBot 过滤）
    const channels = await this.prisma.pageView.groupBy({
      by: ['trafficSource'],
      where: { createdAt: { gte: range.from, lte: range.to }, isBot: false },
      _count: { id: true },
    });

    // 逐渠道串行计算（渠道枚举仅 7 个，串行可接受）
    const funnelData: ChannelFunnelRow[] = [];
    for (const channel of channels) {
      // 访客/深度浏览两层身份口径与 getSources 对齐：COALESCE(visitorId, sessionId)，
      // 兼容无 visitorId 的历史数据（生产旧 schema 未采集 visitorId）
      const [stat] = await this.prisma.$queryRaw<Array<{ visitors: bigint; engaged: bigint }>>`
        SELECT
          COUNT(*)::bigint AS visitors,
          (COUNT(*) FILTER (WHERE pv >= 2))::bigint AS engaged
        FROM (
          SELECT COALESCE("visitorId", "sessionId") AS ident, COUNT(*) AS pv
          FROM "page_views"
          WHERE "isBot" = false
            AND "createdAt" >= ${range.from} AND "createdAt" <= ${range.to}
            AND "trafficSource" IS NOT DISTINCT FROM ${channel.trafficSource}
            AND COALESCE("visitorId", "sessionId") IS NOT NULL
          GROUP BY 1
        ) t
      `;
      const visitors = Number(stat?.visitors ?? 0n);
      const engaged = Number(stat?.engaged ?? 0n);

      // 询盘/客户两层仍按真实 visitorId 关联（sessionId 无法关联转化记录）
      const rows = await this.prisma.pageView.findMany({
        where: {
          trafficSource: channel.trafficSource,
          createdAt: { gte: range.from, lte: range.to },
          isBot: false,
          visitorId: { not: null },
        },
        distinct: ['visitorId'],
        select: { visitorId: true },
      });
      const ids = rows.map((r) => r.visitorId as string);

      const [inquiries, customers] = ids.length
        ? await Promise.all([
            this.prisma.contact.count({
              where: {
                visitorId: { in: ids },
                createdAt: { gte: range.from, lte: range.to },
                deletedAt: null,
              },
            }),
            this.prisma.customer.count({
              where: {
                visitorId: { in: ids },
                createdAt: { gte: range.from, lte: range.to },
                deletedAt: null,
              },
            }),
          ])
        : [0, 0];

      funnelData.push({
        channel: channel.trafficSource ?? 'other',
        funnel: { visitors, engaged, inquiries, customers },
        conversionRates: {
          visitToEngage: round2(visitors > 0 ? (engaged / visitors) * 100 : 0),
          engageToInquiry: round2(engaged > 0 ? (inquiries / engaged) * 100 : 0),
          inquiryToCustomer: round2(inquiries > 0 ? (customers / inquiries) * 100 : 0),
          overall: round2(visitors > 0 ? (customers / visitors) * 100 : 0),
        },
      });
    }

    funnelData.sort((a, b) => b.funnel.visitors - a.funnel.visitors);
    this.writeCache('funnel', range, funnelData);
    return funnelData;
  }

  // ── T+1 预计算：凌晨 2 点预热默认区间缓存 ───────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async precomputeDaily(): Promise<void> {
    const yesterday = new Date(Date.now() - 86400000);
    const to = toYmd(yesterday);
    const from7 = toYmd(new Date(Date.now() - 7 * 86400000));
    const from30 = toYmd(new Date(Date.now() - 30 * 86400000));
    try {
      await Promise.all([
        this.getConversionMetrics(from7, to),
        this.getSupportMetrics(from7, to),
        this.getSourcesFunnel(from30, to),
      ]);
      this.logger.log(`T+1 预计算完成（${from7}~${to} / 漏斗 ${from30}~${to}）`);
    } catch (err) {
      this.logger.error('T+1 预计算失败', err instanceof Error ? err.stack : String(err));
    }
  }

  // ── 进程内缓存（仅历史区间；重启即空，miss 回退实时计算） ────────

  /** 台账写操作后由 Controller 调用：花费参与 inquiryCost，历史区间缓存须失效 */
  clearCache(): void {
    this.cache.clear();
  }

  private cacheKey(kind: string, range: DateRange): string {
    return `${kind}:${range.from.toISOString()}|${range.to.toISOString()}`;
  }

  private readCache<T>(kind: string, range: DateRange): T | null {
    if (!isHistoricalRange(range)) return null;
    const entry = this.cache.get(this.cacheKey(kind, range));
    if (!entry || entry.expiresAt < Date.now()) return null;
    return entry.data as T;
  }

  private writeCache(kind: string, range: DateRange, data: unknown): void {
    if (!isHistoricalRange(range)) return;
    // 防无界增长：容量上限，超限时清空重建（低 QPS 场景足够）
    if (this.cache.size > 200) this.cache.clear();
    this.cache.set(this.cacheKey(kind, range), { data, expiresAt: Date.now() + CACHE_TTL_MS });
  }
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

function round1(n: number): number {
  return Number(n.toFixed(1));
}

function maskAgentEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  return `***${local.slice(-1)}`;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
