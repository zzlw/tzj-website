/**
 * Evaluation Tracker — 评分历史追踪器
 *
 * 记录评分历史、计算趋势、检测告警。
 *
 * @module harness/evaluators/EvaluationTracker
 */

import type { ScoreReport, ScoreRecord, ScoreHistory, ScoreTrend } from '../contracts/Evaluation';

export class EvaluationTracker {
  private readonly history: ScoreRecord[] = [];

  /** 记录一次评分 */
  record(report: ScoreReport): void {
    this.history.push({
      date: report.timestamp,
      commit: report.gitCommit ?? 'unknown',
      total: report.totalScore,
      R: report.dimensions.R.score,
      E: report.dimensions.E.score,
      S: report.dimensions.S.score,
      T: report.dimensions.T.score,
      passed: report.passed,
    });
  }

  /** 获取完整评分历史 */
  getHistory(): ScoreHistory {
    return {
      scores: [...this.history],
      trend: this.calculateTrend(),
      streak: this.calculateStreak(),
      alerts: this.generateAlerts(),
    };
  }

  /** 计算评分趋势 */
  calculateTrend(): ScoreTrend {
    if (this.history.length < 3) return 'stable';
    const last3 = this.history.slice(-3).map((r) => r.total);
    if (last3[2]! > last3[1]! && last3[1]! > last3[0]!) return 'improving';
    if (last3[2]! < last3[1]! && last3[1]! < last3[0]!) return 'declining';
    return 'stable';
  }

  /** 计算通过/失败连续次数 */
  private calculateStreak(): { pass: number; fail: number } {
    let pass = 0;
    let fail = 0;
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i]!.passed) {
        if (fail > 0) break;
        pass++;
      } else {
        if (pass > 0) break;
        fail++;
      }
    }
    return { pass, fail };
  }

  /** 生成告警 */
  private generateAlerts(): string[] {
    const alerts: string[] = [];
    const trend = this.calculateTrend();

    if (trend === 'declining') {
      alerts.push('Score trend declining — review recent changes');
    }

    const lastScore = this.history[this.history.length - 1];
    if (lastScore && lastScore.S < 15) {
      alerts.push('Security score below 15 — immediate security review required');
    }

    if (lastScore && lastScore.total < 70) {
      alerts.push(`Total score ${lastScore.total} below minimum threshold`);
    }

    return alerts;
  }
}
