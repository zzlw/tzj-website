/**
 * Planning Pipeline — 规划流水线
 *
 * 根据上下文分析结果生成检查和评估计划。
 *
 * @module harness/pipeline/PlanningPipeline
 */

import type { ReducedContext } from '../contracts/Context';

export interface InspectionPlan {
  inspectors: string[];
  priority: 'full' | 'quick' | 'security-only';
  fileFilter: (file: string) => boolean;
}

export class PlanningPipeline {
  /**
   * 根据上下文生成检查计划
   */
  execute(context: ReducedContext): InspectionPlan {
    const hasSchemaChanges = context.prismaModels.length > 0;
    const hasFrontendFiles = context.files.some(
      (f) => f.language === 'tsx' || f.language === 'css'
    );

    if (hasSchemaChanges && hasFrontendFiles) {
      return {
        inspectors: [
          'ArchitectureInspector',
          'ComponentInspector',
          'ThemeInspector',
          'SecurityInspector',
          'AccessibilityInspector',
          'PerformanceInspector',
        ],
        priority: 'full',
        fileFilter: () => true,
      };
    }

    if (hasFrontendFiles) {
      return {
        inspectors: [
          'ComponentInspector',
          'ThemeInspector',
          'SecurityInspector',
          'AccessibilityInspector',
          'PerformanceInspector',
        ],
        priority: 'quick',
        fileFilter: (f) => f.endsWith('.tsx') || f.endsWith('.jsx') || f.endsWith('.css'),
      };
    }

    return {
      inspectors: ['SecurityInspector', 'ArchitectureInspector', 'PerformanceInspector'],
      priority: 'security-only',
      fileFilter: (f) => f.endsWith('.ts') || f.endsWith('.tsx'),
    };
  }
}
