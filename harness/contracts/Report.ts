/**
 * Report Contract — 报告数据结构
 *
 * 定义 Harness Pipeline 输出的报告类型。
 *
 * @module harness/contracts/Report
 */

import type { ScoreReport } from './Evaluation';
import type { AggregatedInspectionResult } from './Inspection';
import type { PipelinePhase } from './Context';

/** 诊断错误 */
export interface DiagnosticError {
  code: string;
  message: string;
  file?: string;
  line?: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

/** 诊断报告 */
export interface DiagnosticReport {
  correlationId: string;
  phase: PipelinePhase;
  status: 'pass' | 'fail' | 'rollback';
  inspectionResult?: AggregatedInspectionResult;
  scoreReport?: ScoreReport;
  errors: DiagnosticError[];
  suggestions: string[];
  timestamp: string;
}

/** Pipeline 最终结果 */
export interface PipelineResult {
  status: 'pass' | 'fail' | 'rollback';
  report: DiagnosticReport;
  score?: ScoreReport;
  generated?: string[];
  duration: number;
}

/** 报告格式 */
export type ReportFormat = 'markdown' | 'json';

/** 报告生成器接口 */
export interface Reporter {
  format: ReportFormat;
  generate(result: PipelineResult): string;
}
