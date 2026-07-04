/**
 * Evaluation Contract — 评估数据结构
 *
 * 定义 R.E.S.T 四维评分体系的类型。
 *
 * @module harness/contracts/Evaluation
 */

/** R.E.S.T 维度标识 */
export type Dimension = 'R' | 'E' | 'S' | 'T';

/** 检查状态 */
export type CheckStatus = 'pass' | 'warn' | 'fail';

/** 单项检查结果 */
export interface CheckResult {
  /** 检查 ID，如 "R1.1" */
  checkId: string;
  /** 检查名称 */
  name: string;
  /** 满分 */
  maxScore: number;
  /** 得分 */
  earnedScore: number;
  /** 状态 */
  status: CheckStatus;
  /** 说明 */
  message: string;
  /** 改进建议 */
  suggestions?: string[];
}

/** 单维度得分 */
export interface DimensionScore {
  /** 维度标识 */
  dimension: Dimension;
  /** 满分（R:30, E:25, S:25, T:20） */
  maxScore: number;
  /** 得分 */
  score: number;
  /** 百分比 */
  percentage: number;
  /** 检查明细 */
  checks: CheckResult[];
}

/** 维度得分集合 */
export interface DimensionScores {
  R: DimensionScore;
  E: DimensionScore;
  S: DimensionScore;
  T: DimensionScore;
}

/** 评分报告 */
export interface ScoreReport {
  /** 总分 0-100 */
  totalScore: number;
  /** 是否通过（≥80） */
  passed: boolean;
  /** 各维度得分 */
  dimensions: DimensionScores;
  /** Top 5 改进建议 */
  topSuggestions: string[];
  /** 评分时间 */
  timestamp: string;
  /** Git commit hash */
  gitCommit?: string;
}

/** 评分趋势 */
export type ScoreTrend = 'improving' | 'stable' | 'declining';

/** 评分记录 */
export interface ScoreRecord {
  date: string;
  commit: string;
  total: number;
  R: number;
  E: number;
  S: number;
  T: number;
  passed: boolean;
}

/** 评分历史 */
export interface ScoreHistory {
  scores: ScoreRecord[];
  trend: ScoreTrend;
  streak: { pass: number; fail: number };
  alerts: string[];
}
