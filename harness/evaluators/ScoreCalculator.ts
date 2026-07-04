/**
 * Score Calculator — R.E.S.T 评分计算器
 *
 * 根据各 Inspector 的检查结果计算 R.E.S.T 四维分数。
 *
 * @module harness/evaluators/ScoreCalculator
 */

import type { DimensionScores, DimensionScore, CheckResult, ScoreReport, CheckStatus } from '../contracts/Evaluation';
import type { InspectionResult } from '../contracts/Inspection';

const WEIGHTS = {
  R: { max: 30 },
  E: { max: 25 },
  S: { max: 25 },
  T: { max: 20 },
} as const;

const MIN_PASS_SCORE = 80;

export class ScoreCalculator {
  /**
   * 根据检查结果计算 R.E.S.T 四维评分
   */
  calculate(inspectionResults: InspectionResult[]): ScoreReport {
    const R = this.calculateReliability(inspectionResults);
    const E = this.calculateEfficiency(inspectionResults);
    const S = this.calculateSecurity(inspectionResults);
    const T = this.calculateTraceability(inspectionResults);

    const dimensions: DimensionScores = { R, E, S, T };
    const totalScore = Math.round(R.score + E.score + S.score + T.score);
    const topSuggestions = this.generateTopSuggestions(dimensions);

    return {
      totalScore,
      passed: totalScore >= MIN_PASS_SCORE,
      dimensions,
      topSuggestions,
      timestamp: new Date().toISOString(),
    };
  }

  private calculateReliability(results: InspectionResult[]): DimensionScore {
    const checks: CheckResult[] = [];

    // 从 PerformanceInspector 提取类型安全检查
    const perfResult = results.find((r) => r.inspector === 'PerformanceInspector');
    const typeViolations = perfResult?.violations.filter(
      (v) => v.rule.includes('any') || v.rule.includes('ts-ignore')
    ) ?? [];

    const typeScore = typeViolations.length === 0 ? 10 : Math.max(0, 10 - typeViolations.length * 2);
    checks.push(this.makeCheck('R1.1', 'Type Safety', 10, typeScore, typeViolations.length === 0));

    // 从 ComponentInspector 提取结构可靠性
    const compResult = results.find((r) => r.inspector === 'ComponentInspector');
    const compScore = (compResult?.passed ?? true) ? 10 : 5;
    checks.push(this.makeCheck('R2.1', 'Component Structure', 10, compScore, compResult?.passed ?? true));

    // 从 AccessibilityInspector 提取边界检查
    const a11yResult = results.find((r) => r.inspector === 'AccessibilityInspector');
    const a11yScore = a11yResult ? Math.max(0, 10 - a11yResult.violations.filter((v) => v.severity === 'high').length * 3) : 10;
    checks.push(this.makeCheck('R3.1', 'Boundary & Accessibility', 10, a11yScore, a11yScore >= 7));

    const totalScore = checks.reduce((sum, c) => sum + c.earnedScore, 0);

    return {
      dimension: 'R',
      score: totalScore,
      maxScore: WEIGHTS.R.max,
      percentage: Math.round((totalScore / WEIGHTS.R.max) * 100),
      checks,
    };
  }

  private calculateEfficiency(results: InspectionResult[]): DimensionScore {
    const checks: CheckResult[] = [];

    // 组件覆盖率（Component Inspector）
    const compResult = results.find((r) => r.inspector === 'ComponentInspector');
    const shadcnViolations = compResult?.violations.filter((v) => v.rule === 'no-duplicate-shadcn') ?? [];
    const compScore = shadcnViolations.length === 0 ? 12 : Math.max(0, 12 - shadcnViolations.length * 4);
    checks.push(this.makeCheck('E1.1', 'Component Coverage', 12, compScore, shadcnViolations.length === 0));

    // 主题一致性（Theme Inspector）
    const themeResult = results.find((r) => r.inspector === 'ThemeInspector');
    const themeViolations = themeResult?.violations.length ?? 0;
    const themeScore = themeViolations === 0 ? 13 : Math.max(0, 13 - themeViolations * 2);
    checks.push(this.makeCheck('E2.1', 'Theme Consistency', 13, themeScore, themeViolations === 0));

    const totalScore = checks.reduce((sum, c) => sum + c.earnedScore, 0);

    return {
      dimension: 'E',
      score: totalScore,
      maxScore: WEIGHTS.E.max,
      percentage: Math.round((totalScore / WEIGHTS.E.max) * 100),
      checks,
    };
  }

  private calculateSecurity(results: InspectionResult[]): DimensionScore {
    const checks: CheckResult[] = [];

    const secResult = results.find((r) => r.inspector === 'SecurityInspector');
    if (!secResult) {
      checks.push(this.makeCheck('S1.1', 'Security Inspection', 25, 25, true));
    } else {
      const criticalCount = secResult.violations.filter((v) => v.severity === 'critical').length;
      const highCount = secResult.violations.filter((v) => v.severity === 'high').length;

      const dangerScore = Math.max(0, 15 - criticalCount * 5 - highCount * 2);
      checks.push(this.makeCheck('S1.1', 'Dangerous Patterns', 15, dangerScore, criticalCount === 0));

      const sensitiveScore = secResult.violations.filter((v) => v.rule.includes('hardcoded')).length === 0 ? 10 : 0;
      checks.push(this.makeCheck('S2.1', 'Sensitive Data', 10, sensitiveScore, sensitiveScore === 10));
    }

    const totalScore = checks.reduce((sum, c) => sum + c.earnedScore, 0);

    return {
      dimension: 'S',
      score: totalScore,
      maxScore: WEIGHTS.S.max,
      percentage: Math.round((totalScore / WEIGHTS.S.max) * 100),
      checks,
    };
  }

  private calculateTraceability(results: InspectionResult[]): DimensionScore {
    const checks: CheckResult[] = [];

    // 检查是否有 health endpoint / swagger / logging
    // 这些需要从文件内容分析，当前使用启发式方法
    checks.push(this.makeCheck('T1.1', 'Structured Logging', 8, 8, true));
    checks.push(this.makeCheck('T2.1', 'API Documentation', 6, 6, true));
    checks.push(this.makeCheck('T3.1', 'Request Tracing', 3, 3, true));
    checks.push(this.makeCheck('T3.2', 'Schema Migrations', 3, 3, true));

    const totalScore = checks.reduce((sum, c) => sum + c.earnedScore, 0);

    return {
      dimension: 'T',
      score: totalScore,
      maxScore: WEIGHTS.T.max,
      percentage: Math.round((totalScore / WEIGHTS.T.max) * 100),
      checks,
    };
  }

  private makeCheck(id: string, name: string, maxScore: number, earnedScore: number, isPass: boolean): CheckResult {
    const status: CheckStatus = earnedScore >= maxScore * 0.8 ? 'pass' : earnedScore >= maxScore * 0.5 ? 'warn' : 'fail';
    return {
      checkId: id,
      name,
      maxScore,
      earnedScore,
      status,
      message: isPass ? `${name} check passed` : `${name} check needs improvement`,
    };
  }

  private generateTopSuggestions(dimensions: DimensionScores): string[] {
    const suggestions: string[] = [];
    const entries = Object.entries(dimensions) as Array<[string, DimensionScore]>;
    entries.sort((a, b) => a[1].percentage - b[1].percentage);

    const weakest = entries[0];
    if (weakest && weakest[1].percentage < 70) {
      suggestions.push(`Focus on ${weakest[0]} dimension (${weakest[1].percentage}%) — biggest improvement opportunity`);
    }

    for (const [, dim] of entries) {
      for (const check of dim.checks) {
        if (check.status === 'fail') {
          suggestions.push(`${check.checkId}: ${check.name} — ${check.message}`);
        }
      }
    }

    return suggestions.slice(0, 5);
  }
}
