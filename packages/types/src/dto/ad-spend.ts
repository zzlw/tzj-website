import type { AdPlatform } from '../entities/ad-spend.js';

/** 投放平台常量（API 侧 @IsIn 校验复用；admin 侧自定义 UI 常量，不导入此值） */
export const AD_PLATFORMS = [
  'baidu',
  'google',
  'wechat',
  'other',
] as const satisfies readonly AdPlatform[];

/** 新增/编辑台账记录入参（日期为 YYYY-MM-DD，periodEnd 不得晚于服务器本地今天） */
export interface AdSpendRecordDto {
  platform: AdPlatform;
  periodStart: string;
  periodEnd: string;
  /** 金额（元，>= 0，最多两位小数，上限 9,999,999.99） */
  spend: number;
  note?: string;
}
