/**
 * Inspection Contract — 检查数据结构
 *
 * 定义代码检查器产出的类型。
 *
 * @module harness/contracts/Inspection
 */

/** 违规严重程度 */
export type ViolationSeverity = 'critical' | 'high' | 'medium' | 'low';

/** 单条违规 */
export interface Violation {
  /** 规则 ID */
  rule: string;
  /** 严重程度 */
  severity: ViolationSeverity;
  /** 描述 */
  message: string;
  /** 文件路径 */
  file: string;
  /** 行号 */
  line?: number;
  /** 列号 */
  column?: number;
  /** 修复建议 */
  suggestion?: string;
}

/** 检查统计 */
export interface InspectionStats {
  filesScanned: number;
  violationsFound: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

/** 检查结果 */
export interface InspectionResult {
  /** 是否通过（无 critical 违规） */
  passed: boolean;
  /** 违规列表 */
  violations: Violation[];
  /** 统计信息 */
  stats: InspectionStats;
  /** 检查器标识 */
  inspector: string;
  /** 检查耗时 (ms) */
  duration: number;
}

/** 组合检查结果 */
export interface AggregatedInspectionResult {
  passed: boolean;
  results: InspectionResult[];
  totalViolations: number;
  totalCritical: number;
  totalHigh: number;
}
