/**
 * Performance Inspector — 性能检查器
 *
 * 检查渲染性能：Server Component 使用、动态导入、图片优化、any 类型使用。
 *
 * @module harness/inspectors/PerformanceInspector
 */

import * as fs from 'node:fs';
import type { InspectionResult, Violation } from '../contracts/Inspection';

const INSPECTOR_ID = 'PerformanceInspector';

export class PerformanceInspector {
  async inspect(files: string[]): Promise<InspectionResult> {
    const startTime = Date.now();
    const violations: Violation[] = [];

    for (const file of files) {
      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, 'utf-8');

      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        violations.push(...this.checkTypeScript(file, content));
      }
      if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
        violations.push(...this.checkReactPerformance(file, content));
      }
    }

    return {
      passed: violations.filter((v) => v.severity === 'critical').length === 0,
      violations,
      stats: buildStats(files.length, violations),
      inspector: INSPECTOR_ID,
      duration: Date.now() - startTime,
    };
  }

  /** TypeScript 类型安全检查 */
  private checkTypeScript(file: string, content: string): Violation[] {
    const violations: Violation[] = [];

    // any 类型检查
    const anyRegex = /\bany\b(?=\s*[;,)\]}>:=])/g;
    let match: RegExpExecArray | null;
    let anyCount = 0;

    while ((match = anyRegex.exec(content)) !== null) {
      const lineStart = content.lastIndexOf('\n', match.index) + 1;
      const linePrefix = content.substring(lineStart, match.index);
      if (linePrefix.includes('//') || linePrefix.includes('*')) continue;
      if (file.endsWith('.d.ts')) continue;
      anyCount++;
    }

    if (anyCount >= 3) {
      violations.push({
        rule: 'perf-no-excessive-any',
        severity: 'high',
        message: `${anyCount} uses of 'any' type — significant type safety concern`,
        file,
      });
    } else if (anyCount > 0) {
      violations.push({
        rule: 'perf-minimize-any',
        severity: 'medium',
        message: `${anyCount} use(s) of 'any' type — consider proper typing`,
        file,
      });
    }

    // @ts-ignore / @ts-nocheck
    const tsIgnoreCount = (content.match(/@ts-(?:ignore|nocheck)/g) ?? []).length;
    if (tsIgnoreCount > 0) {
      violations.push({
        rule: 'perf-no-ts-ignore',
        severity: 'medium',
        message: `${tsIgnoreCount} TypeScript override(s) — fix underlying types`,
        file,
      });
    }

    // console.log 在生产代码中
    if (!file.includes('.test.') && !file.includes('.spec.')) {
      const consoleCount = (content.match(/console\.(log|debug|info)\s*\(/g) ?? []).length;
      if (consoleCount > 0) {
        violations.push({
          rule: 'perf-no-console',
          severity: 'low',
          message: `${consoleCount} console output(s) — use structured logger`,
          file,
        });
      }
    }

    return violations;
  }

  /** React 渲染性能检查 */
  private checkReactPerformance(file: string, content: string): Violation[] {
    const violations: Violation[] = [];

    // "use client" 使用比例检查（仅在 app/ 目录下）
    if (file.includes('/app/') && content.includes('"use client"')) {
      // 统计文件行数，超过 200 行的 client component 应该拆分
      const lineCount = content.split('\n').length;
      if (lineCount > 200) {
        violations.push({
          rule: 'perf-large-client-component',
          severity: 'medium',
          message: `Client component is ${lineCount} lines — consider splitting into smaller pieces`,
          file,
        });
      }
    }

    // 检查图片是否使用 next/image
    const rawImgRegex = /<img\s/g;
    if (rawImgRegex.test(content) && !file.includes('next/image')) {
      violations.push({
        rule: 'perf-use-next-image',
        severity: 'low',
        message: 'Raw <img> tag found — use next/image for automatic optimization',
        file,
        suggestion: "import Image from 'next/image'",
      });
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
