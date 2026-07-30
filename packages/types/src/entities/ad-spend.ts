/**
 * 广告花费台账（docs/ad-spend-ledger-design.md）
 * 分平台分时段记账；手工录入与未来百度 API 同步共用同一实体。
 */

/** 投放平台标识（应用层常量约束，DB 存 String 便于扩平台） */
export type AdPlatform = 'baidu' | 'google' | 'wechat' | 'other';

/** 记录来源：manual（手工录入）/ baidu_api（升级 2 自动同步预留） */
export type AdSpendSource = 'manual' | 'baidu_api';

/** 台账记录（区间为日历日 YYYY-MM-DD，含首尾；单日记录 periodStart == periodEnd） */
export interface AdSpendRecord {
  id: string;
  platform: AdPlatform;
  periodStart: string;
  periodEnd: string;
  /** 金额（元，两位小数） */
  spend: number;
  source: AdSpendSource;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 查询区间内按天分摊聚合的花费汇总（分摊口径见设计文档 §4） */
export interface AdSpendSummary {
  byPlatform: Array<{ platform: AdPlatform; spend: number }>;
  total: number;
}

/** GET /analytics/ad-spend 响应：原始记录列表 + 分摊聚合（两者口径不同，之和不必相等） */
export interface AdSpendListResponse extends AdSpendSummary {
  items: AdSpendRecord[];
}
