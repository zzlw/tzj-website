import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
// biome-ignore lint/style/useImportType: NestJS DI 需要类作为运行期注入 token
import { PrismaService } from '../prisma/prisma.service';

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

/** 广告花费 Setting KV 键（Phase1 手动录入，参与询盘成本计算） */
const AD_SPEND_SETTING_KEY = 'growth.adSpend';

export interface ConversionMetricsResponse {
  dateRange: { from: Date; to: Date };
  totalVisitors: number;
  convertedCustomers: number;
  conversionRate: number; // %
  adVisitors: number;
  adCustomers: number;
  adConversionRate: number; // %
  adInquiries: number;
  adSpend: number; // 元（Setting KV：growth.adSpend，手动录入）
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

  constructor(private readonly prisma: PrismaService) {}

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

    // 4. 询盘成本（CAC 近似）：广告预算 Phase1 手动录入 Setting KV（growth.adSpend）
    const { adSpend } = await this.getGrowthSettings();
    const inquiryCost = adInquiries > 0 ? adSpend / adInquiries : 0;

    const result: ConversionMetricsResponse = {
      dateRange: { from: range.from, to: range.to },
      totalVisitors,
      convertedCustomers,
      conversionRate: round2(conversionRate),
      adVisitors,
      adCustomers,
      adConversionRate: round2(adConversionRate),
      adInquiries,
      adSpend,
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
    // maskedId 脱敏口径：邮箱本地部分末位字符，其余 ***（如 agent3@tzj.com → ***3）
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

    const agentRankings = agentRows.map((r) => {
      const total = Number(r.totalRooms);
      const converted = Number(r.convertedRooms);
      return {
        maskedId: maskAgentEmail(r.agentEmail),
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

    // 逐渠道串行计算（渠道枚举仅 7 个，串行可接受；每渠道 fetch→map→count 三步）
    const funnelData: ChannelFunnelRow[] = [];
    for (const channel of channels) {
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
      const visitors = ids.length;

      // 深度浏览（Phase1 简化：同一访客 PV ≥ 2 即视为 engaged，
      // 规避 localePrefix 路径维护；行为事件表延至 Phase2）
      const engaged = visitors
        ? (
            await this.prisma.pageView.groupBy({
              by: ['visitorId'],
              where: {
                trafficSource: channel.trafficSource,
                createdAt: { gte: range.from, lte: range.to },
                visitorId: { in: ids },
              },
              _count: { id: true },
              having: { id: { _count: { gte: 2 } } },
            })
          ).length
        : 0;

      const [inquiries, customers] = visitors
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

  // ── 增长看板设置（广告花费手动录入） ──────────────────────────────

  async getGrowthSettings(): Promise<{ adSpend: number }> {
    const row = await this.prisma.setting.findUnique({ where: { key: AD_SPEND_SETTING_KEY } });
    return { adSpend: typeof row?.value === 'number' ? row.value : 0 };
  }

  async updateGrowthSettings(adSpend: number): Promise<{ adSpend: number }> {
    await this.prisma.setting.upsert({
      where: { key: AD_SPEND_SETTING_KEY },
      update: { value: adSpend },
      create: { key: AD_SPEND_SETTING_KEY, value: adSpend, group: 'growth', label: '广告花费' },
    });
    // 花费参与 inquiryCost 计算：清空 T+1 缓存，避免历史区间返回旧花费
    this.cache.clear();
    this.logger.log(`广告花费已更新：¥${adSpend}`);
    return { adSpend };
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
