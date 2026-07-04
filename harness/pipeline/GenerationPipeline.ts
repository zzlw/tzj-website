/**
 * Generation Pipeline — 代码生成流水线
 *
 * 在评估通过后执行代码生成/修改操作。
 * 生成前进行 pre-flight 检查，生成后进行 post-flight 验证。
 *
 * @module harness/pipeline/GenerationPipeline
 */

import type { ScoreReport } from '../contracts/Evaluation';
import type { Reflection } from './ReflectionPipeline';

export interface GenerationPlan {
  action: 'approve' | 'approve-with-warnings' | 'reject';
  files: string[];
  warnings: string[];
  blockers: string[];
}

const MIN_PASS_SCORE = 80;

export class GenerationPipeline {
  /**
   * 根据评分和反思结果决定是否批准生成
   */
  execute(score: ScoreReport, reflections: Reflection[]): GenerationPlan {
    const warnings: string[] = [];
    const blockers: string[] = [];

    // 检查评分
    if (score.totalScore < MIN_PASS_SCORE) {
      blockers.push(`Score ${score.totalScore}/100 below minimum threshold (${MIN_PASS_SCORE})`);
    }

    // 检查安全维度
    if (score.dimensions.S.percentage < 60) {
      blockers.push(`Security score ${score.dimensions.S.percentage}% — critical security concerns`);
    }

    // 收集反思中的 action 级别建议为 warning
    for (const r of reflections) {
      if (r.severity === 'action') {
        warnings.push(r.insight);
      }
      if (r.severity === 'warning' && r.category === 'performance') {
        warnings.push(r.insight);
      }
    }

    // 收集评分建议
    warnings.push(...score.topSuggestions);

    // 判定结果
    const action: GenerationPlan['action'] =
      blockers.length > 0
        ? 'reject'
        : warnings.length > 0
          ? 'approve-with-warnings'
          : 'approve';

    return { action, files: [], warnings, blockers };
  }
}
