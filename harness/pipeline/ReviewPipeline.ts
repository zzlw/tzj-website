/**
 * Review Pipeline — 审查流水线
 *
 * 整合所有 Pipeline 的执行结果，生成最终的审查报告。
 *
 * @module harness/pipeline/ReviewPipeline
 */

import type { ScoreReport } from '../contracts/Evaluation';
import type { InspectionResult } from '../contracts/Inspection';
import type { PipelineResult, DiagnosticReport, DiagnosticError } from '../contracts/Report';
import type { GenerationPlan } from './GenerationPipeline';
import type { Reflection } from './ReflectionPipeline';

export class ReviewPipeline {
  /**
   * 生成最终审查报告
   */
  execute(params: {
    correlationId: string;
    inspectionResults: InspectionResult[];
    score: ScoreReport;
    reflections: Reflection[];
    generationPlan: GenerationPlan;
    startTime: number;
  }): PipelineResult {
    const { correlationId, inspectionResults, score, reflections, generationPlan, startTime } = params;

    const errors: DiagnosticError[] = [];
    for (const result of inspectionResults) {
      for (const v of result.violations) {
        errors.push({
          code: v.rule,
          message: v.message,
          file: v.file,
          line: v.line,
          severity: v.severity,
        });
      }
    }

    const suggestions = [
      ...generationPlan.blockers.map((b) => `[BLOCKER] ${b}`),
      ...generationPlan.warnings.map((w) => `[WARNING] ${w}`),
      ...reflections
        .filter((r) => r.severity === 'action')
        .map((r) => `[ACTION] ${r.insight}`),
    ];

    const report: DiagnosticReport = {
      correlationId,
      phase: generationPlan.action === 'reject' ? 'rollback' : 'complete',
      status: generationPlan.action === 'reject' ? 'fail' : 'pass',
      errors,
      suggestions,
      timestamp: new Date().toISOString(),
    };

    return {
      status: generationPlan.action === 'reject' ? 'rollback' : 'pass',
      report,
      score,
      duration: Date.now() - startTime,
    };
  }
}
