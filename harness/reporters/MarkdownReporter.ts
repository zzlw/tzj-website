/**
 * Markdown Reporter — Markdown 报告生成器
 *
 * 将 Pipeline 结果转换为 Markdown 格式报告。
 *
 * @module harness/reporters/MarkdownReporter
 */

import type { PipelineResult } from '../contracts/Report';
import type { Reporter } from '../contracts/Report';

export class MarkdownReporter implements Reporter {
  readonly format = 'markdown' as const;

  generate(result: PipelineResult): string {
    const { report, score, duration } = result;
    const lines: string[] = [];

    lines.push('# Harness Quality Report');
    lines.push('');
    lines.push(`**Status**: ${result.status === 'pass' ? '✅ PASS' : '🚫 FAIL'}`);
    lines.push(`**Correlation ID**: \`${report.correlationId}\``);
    lines.push(`**Duration**: ${duration}ms`);
    lines.push(`**Timestamp**: ${report.timestamp}`);
    lines.push('');

    if (score) {
      lines.push('## R.E.S.T Score');
      lines.push('');
      lines.push(`| Dimension | Score | Max | % |`);
      lines.push(`|-----------|-------|-----|---|`);
      lines.push(`| Reliability (R) | ${score.dimensions.R.score} | ${score.dimensions.R.maxScore} | ${score.dimensions.R.percentage}% |`);
      lines.push(`| Efficiency (E) | ${score.dimensions.E.score} | ${score.dimensions.E.maxScore} | ${score.dimensions.E.percentage}% |`);
      lines.push(`| Security (S) | ${score.dimensions.S.score} | ${score.dimensions.S.maxScore} | ${score.dimensions.S.percentage}% |`);
      lines.push(`| Traceability (T) | ${score.dimensions.T.score} | ${score.dimensions.T.maxScore} | ${score.dimensions.T.percentage}% |`);
      lines.push(`| **Total** | **${score.totalScore}** | **100** | ${score.passed ? '✅' : '🚫'} |`);
      lines.push('');
    }

    if (report.errors.length > 0) {
      lines.push('## Errors');
      lines.push('');
      for (const err of report.errors) {
        lines.push(`- **[${err.severity.toUpperCase()}]** \`${err.code}\` — ${err.message}${err.file ? ` (${err.file}:${err.line ?? '?'})` : ''}`);
      }
      lines.push('');
    }

    if (report.suggestions.length > 0) {
      lines.push('## Suggestions');
      lines.push('');
      for (const s of report.suggestions) {
        lines.push(`- ${s}`);
      }
      lines.push('');
    }

    if (score?.topSuggestions.length) {
      lines.push('## Top Improvements');
      lines.push('');
      for (const s of score.topSuggestions) {
        lines.push(`1. ${s}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
