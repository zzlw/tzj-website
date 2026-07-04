/**
 * JSON Reporter — JSON 报告生成器
 *
 * 将 Pipeline 结果转换为结构化 JSON 格式报告。
 *
 * @module harness/reporters/JsonReporter
 */

import type { PipelineResult, Reporter } from '../contracts/Report';

export class JsonReporter implements Reporter {
  readonly format = 'json' as const;

  generate(result: PipelineResult): string {
    return JSON.stringify(
      {
        version: '1.0.0',
        status: result.status,
        correlationId: result.report.correlationId,
        timestamp: result.report.timestamp,
        duration: result.duration,
        score: result.score
          ? {
              total: result.score.totalScore,
              passed: result.score.passed,
              dimensions: {
                R: { score: result.score.dimensions.R.score, max: result.score.dimensions.R.maxScore },
                E: { score: result.score.dimensions.E.score, max: result.score.dimensions.E.maxScore },
                S: { score: result.score.dimensions.S.score, max: result.score.dimensions.S.maxScore },
                T: { score: result.score.dimensions.T.score, max: result.score.dimensions.T.maxScore },
              },
              topSuggestions: result.score.topSuggestions,
            }
          : null,
        errors: result.report.errors.map((e) => ({
          code: e.code,
          severity: e.severity,
          message: e.message,
          file: e.file,
          line: e.line,
        })),
        suggestions: result.report.suggestions,
      },
      null,
      2
    );
  }
}
