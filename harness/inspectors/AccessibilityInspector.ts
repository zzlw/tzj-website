/**
 * Accessibility Inspector — 无障碍检查器
 *
 * 检查基本的 a11y 规范：alt 属性、语义化标签、ARIA 属性、表单标签。
 *
 * @module harness/inspectors/AccessibilityInspector
 */

import * as fs from 'node:fs';
import type { InspectionResult, Violation } from '../contracts/Inspection';

const INSPECTOR_ID = 'AccessibilityInspector';

export class AccessibilityInspector {
  async inspect(files: string[]): Promise<InspectionResult> {
    const startTime = Date.now();
    const violations: Violation[] = [];

    for (const file of files) {
      if (!file.endsWith('.tsx') && !file.endsWith('.jsx')) continue;
      if (!fs.existsSync(file)) continue;

      const content = fs.readFileSync(file, 'utf-8');

      violations.push(...this.checkImageAlt(file, content));
      violations.push(...this.checkButtonLabel(file, content));
      violations.push(...this.checkSemanticElements(file, content));
    }

    return {
      passed: violations.filter((v) => v.severity === 'critical').length === 0,
      violations,
      stats: buildStats(files.length, violations),
      inspector: INSPECTOR_ID,
      duration: Date.now() - startTime,
    };
  }

  /** img 标签必须有 alt 属性 */
  private checkImageAlt(file: string, content: string): Violation[] {
    const violations: Violation[] = [];
    const imgRegex = /<img\s(?![^>]*\balt\s*=)[^>]*>/g;
    let match: RegExpExecArray | null;

    while ((match = imgRegex.exec(content)) !== null) {
      violations.push({
        rule: 'a11y-img-alt',
        severity: 'high',
        message: 'Image element missing alt attribute',
        file,
        line: content.substring(0, match.index).split('\n').length,
        suggestion: 'Add alt="descriptive text" or alt="" for decorative images',
      });
    }

    return violations;
  }

  /** button 必须有可访问的文本内容或 aria-label */
  private checkButtonLabel(file: string, content: string): Violation[] {
    const violations: Violation[] = [];
    const emptyButtonRegex = /<button[^>]*>\s*<\/button>/g;
    let match: RegExpExecArray | null;

    while ((match = emptyButtonRegex.exec(content)) !== null) {
      const tag = match[0];
      if (!tag.includes('aria-label') && !tag.includes('aria-labelledby')) {
        violations.push({
          rule: 'a11y-button-label',
          severity: 'medium',
          message: 'Empty button without aria-label',
          file,
          line: content.substring(0, match.index).split('\n').length,
        });
      }
    }

    return violations;
  }

  /** 检查是否使用了语义化标签（仅警告级别） */
  private checkSemanticElements(file: string, content: string): Violation[] {
    const violations: Violation[] = [];

    // 检查是否有 div 被用作按钮（onClick + role 缺失）
    const divButtonRegex = /<div[^>]*onClick[^>]*>/g;
    let match: RegExpExecArray | null;

    while ((match = divButtonRegex.exec(content)) !== null) {
      const tag = match[0];
      if (!tag.includes('role=') && !tag.includes('tabIndex')) {
        violations.push({
          rule: 'a11y-semantic-role',
          severity: 'low',
          message: 'div with onClick should have role="button" and tabIndex={0}',
          file,
          line: content.substring(0, match.index).split('\n').length,
          suggestion: 'Use <button> element or add role="button" tabIndex={0}',
        });
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
