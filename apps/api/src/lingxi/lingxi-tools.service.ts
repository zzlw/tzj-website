import { Injectable, Logger } from '@nestjs/common';
import type OpenAI from 'openai';
import { AdSpendService } from '../analytics/ad-spend.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { GrowthMetricsService } from '../analytics/growth-metrics.service';

/**
 * 单次工具执行结果。
 * data：注入 LLM 的脱敏聚合数据（白名单挑选 + Top N 裁剪，防 token 爆炸）；
 * summary：tool 帧的人类可读摘要；rows / range：dataRef 溯源卡片素材。
 */
export interface LingxiToolResult {
  data: unknown;
  summary: string;
  rows: number;
  range: string;
}

/** 工具通用时间参数（LLM 由规划结果填入；缺省时服务层回落近 7 天） */
interface RangeArgs {
  from?: string;
  to?: string;
}

const RANGE_PROPS = {
  from: {
    type: 'string',
    description: '起始日期（YYYY-MM-DD，含当天）。必须给出规划确定的明确日期',
  },
  to: { type: 'string', description: '结束日期（YYYY-MM-DD，含当天）' },
} as const;

const TOP_LIMIT = 10;

/**
 * 灵犀工具注册表：JSON Schema 定义 + 执行分发（docs/lingxi-ai-report-design.md §5.5）。
 *
 * 隐私红线（Constitutional）：注入 LLM 的一律是聚合数据，本层为脱敏白名单——
 * 每个工具的返回都逐字段显式挑选，严禁 email/phone/name/company/IP/ipMasked/visitorId
 * 等明细字段透出；访客明细类方法（listVisitors / visitor-activity 等）不注册为工具。
 * 全部工具只读，与报表页共用同一服务层方法，口径永远一致。
 */
@Injectable()
export class LingxiToolsService {
  private readonly logger = new Logger(LingxiToolsService.name);

  constructor(
    private readonly analytics: AnalyticsService,
    private readonly growth: GrowthMetricsService,
    private readonly adSpend: AdSpendService,
  ) {}

  /** openai SDK 的 tools 参数（function calling JSON Schema） */
  get definitions(): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return [
      this.def('get_overview', 'PV/UV 总量与趋势、Top 页面/设备/浏览器占比。看整体盘子用', {
        ...RANGE_PROPS,
        granularity: {
          type: 'string',
          enum: ['hour', 'day', 'week', 'month'],
          description: '趋势桶粒度，缺省由范围跨度自动决定',
        },
      }),
      this.def(
        'get_sources',
        '渠道分组占比（direct/organic/paid 等）、广告系列、UTM 来源排行',
        RANGE_PROPS,
      ),
      this.def(
        'get_sources_funnel',
        '逐渠道四层转化漏斗（访客→深度互动→询盘→客户）及层间转化率',
        RANGE_PROPS,
      ),
      this.def(
        'get_conversion_metrics',
        '访客→客户转化率、付费渠道归因（广告访客/客户/询盘数）、询盘成本 CPL（花费为期间台账分摊值）',
        RANGE_PROPS,
      ),
      this.def(
        'get_ad_spend',
        '所选期间分平台广告花费（台账按天分摊聚合，跨区间记录为均匀分摊近似）',
        RANGE_PROPS,
      ),
      this.def('list_top_pages', `热门落地页 Top ${TOP_LIMIT}（PV/UV）`, RANGE_PROPS),
      this.def('list_top_regions', `访客地区分布 Top ${TOP_LIMIT}`, RANGE_PROPS),
      this.def('list_top_referrers', `引荐来源域名 Top ${TOP_LIMIT}`, RANGE_PROPS),
    ];
  }

  /**
   * 执行分发。异常不外抛：以 {error} 回填给 LLM，
   * 让其基于其余数据继续生成并声明数据缺口（§5.10）。
   */
  async execute(name: string, args: Record<string, unknown>): Promise<LingxiToolResult> {
    const range = this.rangeLabel(args as RangeArgs);
    try {
      switch (name) {
        case 'get_overview':
          return await this.getOverview(args as RangeArgs & { granularity?: string });
        case 'get_sources':
          return await this.getSources(args as RangeArgs);
        case 'get_sources_funnel':
          return await this.getSourcesFunnel(args as RangeArgs);
        case 'get_conversion_metrics':
          return await this.getConversionMetrics(args as RangeArgs);
        case 'get_ad_spend':
          return await this.getAdSpend(args as RangeArgs);
        case 'list_top_pages':
          return await this.listTopPages(args as RangeArgs);
        case 'list_top_regions':
          return await this.listTopRegions(args as RangeArgs);
        case 'list_top_referrers':
          return await this.listTopReferrers(args as RangeArgs);
        default:
          return { data: { error: `未知工具 ${name}` }, summary: '未知工具', rows: 0, range };
      }
    } catch (err) {
      this.logger.warn(`灵犀工具执行失败 ${name}: ${(err as Error).message}`);
      return {
        data: { error: '该数据源暂时不可用，请基于其余数据生成并声明此缺口' },
        summary: '取数失败',
        rows: 0,
        range,
      };
    }
  }

  private async getOverview(args: RangeArgs & { granularity?: string }): Promise<LingxiToolResult> {
    const raw = await this.analytics.getOverview(args.from, args.to, args.granularity);
    // 白名单挑选：丢弃 browserVersions 明细与 topReferrers/topRegions（有专属工具），控 token
    const data = {
      granularity: raw.granularity,
      summary: raw.summary,
      trend: raw.daily,
      topPages: raw.topPages,
      devices: raw.devices,
      browsers: raw.browsers,
    };
    return {
      data,
      summary: `PV ${raw.summary.pageViews} · UV ${raw.summary.uniqueVisitors} · 趋势 ${raw.daily.length} 桶`,
      rows: raw.daily.length,
      range: this.rangeLabel(args),
    };
  }

  private async getSources(args: RangeArgs): Promise<LingxiToolResult> {
    const raw = await this.analytics.getSources(args.from, args.to);
    const data = {
      channels: raw.channels,
      topCampaigns: raw.topCampaigns.slice(0, TOP_LIMIT),
      topSources: raw.topSources.slice(0, TOP_LIMIT),
    };
    return {
      data,
      summary: `渠道 ${raw.channels.length} 组 · 广告系列 ${data.topCampaigns.length} 个`,
      rows: raw.channels.length,
      range: this.rangeLabel(args),
    };
  }

  private async getSourcesFunnel(args: RangeArgs): Promise<LingxiToolResult> {
    const rows = await this.growth.getSourcesFunnel(args.from, args.to);
    return {
      data: rows,
      summary: `渠道漏斗 ${rows.length} 组`,
      rows: rows.length,
      range: this.rangeLabel(args),
    };
  }

  private async getConversionMetrics(args: RangeArgs): Promise<LingxiToolResult> {
    const raw = await this.growth.getConversionMetrics(args.from, args.to);
    // dateRange 换算为字符串（Date 对象 JSON 化后冗长），其余字段全为聚合指标
    const data = {
      from: raw.dateRange.from.toISOString().slice(0, 10),
      to: raw.dateRange.to.toISOString().slice(0, 10),
      totalVisitors: raw.totalVisitors,
      convertedCustomers: raw.convertedCustomers,
      conversionRate: raw.conversionRate,
      adVisitors: raw.adVisitors,
      adCustomers: raw.adCustomers,
      adConversionRate: raw.adConversionRate,
      adInquiries: raw.adInquiries,
      adSpend: raw.adSpend,
      adSpendByPlatform: raw.adSpendByPlatform,
      inquiryCost: raw.inquiryCost,
    };
    return {
      data,
      summary: `转化率 ${raw.conversionRate}% · 询盘成本 ¥${raw.inquiryCost}`,
      rows: 1,
      range: this.rangeLabel(args),
    };
  }

  private async getAdSpend(args: RangeArgs): Promise<LingxiToolResult> {
    // 与看板同口径：台账按天分摊聚合（白名单只透 byPlatform/total，不透逐条记录）
    const raw = await this.adSpend.list(args.from, args.to);
    const parts = raw.byPlatform.map((p) => `${p.platform} ¥${p.spend}`).join(' / ');
    return {
      data: {
        byPlatform: raw.byPlatform,
        total: raw.total,
        note: '台账按天分摊口径，跨区间记录为均匀分摊近似；total=0 表示该期间未录入花费',
      },
      summary: raw.total > 0 ? `期间广告花费 ¥${raw.total}（${parts}）` : '该期间未录入广告花费',
      rows: raw.items.length,
      range: args.from || args.to ? this.rangeLabel(args) : '近 365 天（默认）',
    };
  }

  private async listTopPages(args: RangeArgs): Promise<LingxiToolResult> {
    const raw = await this.analytics.listPages({ page: 1, limit: TOP_LIMIT, ...args });
    const data = raw.data.map((r) => ({
      path: r.path,
      title: r.title,
      pageViews: r.pageViews,
      uniqueVisitors: r.uniqueVisitors,
    }));
    return {
      data,
      summary: `热门页面 ${data.length} 条`,
      rows: data.length,
      range: this.rangeLabel(args),
    };
  }

  private async listTopRegions(args: RangeArgs): Promise<LingxiToolResult> {
    const raw = await this.analytics.listRegions({ page: 1, limit: TOP_LIMIT, ...args });
    const data = raw.data.map((r) => ({
      region: r.region,
      pageViews: r.pageViews,
      uniqueVisitors: r.uniqueVisitors,
    }));
    return {
      data,
      summary: `地区分布 ${data.length} 条`,
      rows: data.length,
      range: this.rangeLabel(args),
    };
  }

  private async listTopReferrers(args: RangeArgs): Promise<LingxiToolResult> {
    const raw = await this.analytics.listReferrers({ page: 1, limit: TOP_LIMIT, ...args });
    const data = raw.data.map((r) => ({ referrerHost: r.referrerHost, pageViews: r.pageViews }));
    return {
      data,
      summary: `引荐来源 ${data.length} 条`,
      rows: data.length,
      range: this.rangeLabel(args),
    };
  }

  private def(
    name: string,
    description: string,
    properties: Record<string, unknown>,
  ): OpenAI.Chat.Completions.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name,
        description,
        parameters: { type: 'object', properties, additionalProperties: false },
      },
    };
  }

  /** dataRef 溯源卡片的时间范围标签（与服务层缺省口径一致：近 7 天） */
  private rangeLabel(args: RangeArgs): string {
    if (args.from || args.to) return `${args.from ?? '…'} ~ ${args.to ?? '今天'}`;
    return '近 7 天（默认）';
  }
}
