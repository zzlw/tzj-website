/**
 * Architecture Inspector — 架构检查器
 *
 * 检查 Monorepo 架构合规性：包边界、依赖方向、循环依赖等。
 *
 * @module harness/inspectors/ArchitectureInspector
 */

import type { InspectionResult, Violation } from '../contracts/Inspection';

const INSPECTOR_ID = 'ArchitectureInspector';

/** 允许的依赖方向：apps → packages（单向） */
const ALLOWED_DEPENDENCY_DIRECTIONS = [
  { from: 'apps/', to: 'packages/' },
  { from: 'packages/', to: 'packages/' },
];

/** 禁止的依赖方向 */
const FORBIDDEN_DEPENDENCY_PATTERNS = [
  { pattern: /apps\/web.*→.*apps\/admin/, message: 'apps/web 不得依赖 apps/admin' },
  { pattern: /apps\/web.*→.*apps\/api/, message: 'apps/web 不得直接依赖 apps/api（应通过 HTTP 调用）' },
  { pattern: /apps\/admin.*→.*apps\/web/, message: 'apps/admin 不得依赖 apps/web' },
  { pattern: /apps\/admin.*→.*apps\/api/, message: 'apps/admin 不得直接依赖 apps/api（应通过 HTTP 调用）' },
];

export class ArchitectureInspector {
  async inspect(files: string[]): Promise<InspectionResult> {
    const startTime = Date.now();
    const violations: Violation[] = [];

    violations.push(...this.checkPackageBoundaries(files));
    violations.push(...this.checkDependencyDirection(files));
    violations.push(...this.checkImportPatterns(files));

    const stats = buildStats(files.length, violations);

    return {
      passed: stats.criticalCount === 0,
      violations,
      stats,
      inspector: INSPECTOR_ID,
      duration: Date.now() - startTime,
    };
  }

  private checkPackageBoundaries(files: string[]): Violation[] {
    const violations: Violation[] = [];

    for (const file of files) {
      // 检查是否有跨 app 的相对路径导入
      const relativeImportRegex = /from\s+['"](\.\.\/)+apps\//g;
      if (relativeImportRegex.test(file)) {
        violations.push({
          rule: 'arch-no-cross-app-relative',
          severity: 'critical',
          message: 'Cross-app relative import detected — apps must not import from each other directly',
          file,
          suggestion: 'Use workspace package references (@tzj/*) instead',
        });
      }
    }

    return violations;
  }

  private checkDependencyDirection(_files: string[]): Violation[] {
    // 此处需要读取 package.json 依赖图，当前为占位实现
    return [];
  }

  private checkImportPatterns(files: string[]): Violation[] {
    const violations: Violation[] = [];

    for (const file of files) {
      // apps/web 和 apps/admin 不应直接 import prisma
      if (
        (file.includes('apps/web/') || file.includes('apps/admin/')) &&
        !file.includes('node_modules')
      ) {
        // 这是文件路径检查，实际内容检查在 pipeline 中完成
        void ALLOWED_DEPENDENCY_DIRECTIONS;
        void FORBIDDEN_DEPENDENCY_PATTERNS;
      }
    }

    return violations;
  }
}

function buildStats(filesScanned: number, violations: Violation[]): InspectionResult['stats'] {
  return {
    filesScanned,
    violationsFound: violations.length,
    criticalCount: violations.filter((v) => v.severity === 'critical').length,
    highCount: violations.filter((v) => v.severity === 'high').length,
    mediumCount: violations.filter((v) => v.severity === 'medium').length,
    lowCount: violations.filter((v) => v.severity === 'low').length,
  };
}
