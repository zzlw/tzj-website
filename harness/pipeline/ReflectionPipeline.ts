/**
 * Reflection Pipeline — 反思流水线
 *
 * 分析检查结果，生成反思洞察和改进建议。
 *
 * @module harness/pipeline/ReflectionPipeline
 */

import type { ReducedContext } from '../contracts/Context';
import type { InspectionResult } from '../contracts/Inspection';

export interface Reflection {
  category: string;
  insight: string;
  severity: 'info' | 'warning' | 'action';
}

export class ReflectionPipeline {
  /**
   * 分析检查结果并生成反思洞察
   */
  execute(context: ReducedContext, results: InspectionResult[]): Reflection[] {
    const reflections: Reflection[] = [];

    reflections.push(...this.reflectOnModelCoverage(context, results));
    reflections.push(...this.reflectOnViolationPatterns(results));
    reflections.push(...this.reflectOnClientComponentRatio(context));

    return reflections;
  }

  private reflectOnModelCoverage(context: ReducedContext, _results: InspectionResult[]): Reflection[] {
    const reflections: Reflection[] = [];
    const unmappedModels = context.models.filter(
      (m) => !context.bentoGrid.items.some((i) => i.model === m)
    );

    if (unmappedModels.length > 0) {
      reflections.push({
        category: 'coverage',
        insight: `Unmapped Prisma models: ${unmappedModels.join(', ')} — consider adding UI representations`,
        severity: 'warning',
      });
    }

    return reflections;
  }

  private reflectOnViolationPatterns(results: InspectionResult[]): Reflection[] {
    const reflections: Reflection[] = [];
    const grouped: Record<string, number> = {};

    for (const result of results) {
      for (const v of result.violations) {
        grouped[v.rule] = (grouped[v.rule] ?? 0) + 1;
      }
    }

    for (const [rule, count] of Object.entries(grouped)) {
      if (count >= 3) {
        reflections.push({
          category: 'pattern',
          insight: `Rule "${rule}" violated ${count} times — consider bulk fix or config adjustment`,
          severity: 'action',
        });
      }
    }

    return reflections;
  }

  private reflectOnClientComponentRatio(context: ReducedContext): Reflection[] {
    const reflections: Reflection[] = [];
    const clientFiles = context.files.filter((f) => f.content.includes('"use client"'));

    if (clientFiles.length > context.files.length * 0.5) {
      const ratio = Math.round((clientFiles.length / context.files.length) * 100);
      reflections.push({
        category: 'performance',
        insight: `${ratio}% of files are client components — review if Server Components can be used`,
        severity: 'warning',
      });
    }

    return reflections;
  }
}
