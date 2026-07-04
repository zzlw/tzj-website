/**
 * Theme Inspector — 主题检查器
 *
 * 检查 Tailwind CSS 类名合法性、Design Token 使用率、硬编码颜色检测。
 *
 * @module harness/inspectors/ThemeInspector
 */

import * as fs from 'node:fs';
import type { InspectionResult, Violation } from '../contracts/Inspection';

const INSPECTOR_ID = 'ThemeInspector';

/** 允许的 Tailwind 自定义 token 前缀 */
const VALID_TOKEN_PREFIXES = [
  'bg-background', 'bg-foreground', 'bg-primary', 'bg-secondary',
  'bg-accent', 'bg-muted', 'bg-destructive', 'bg-surface', 'bg-card',
  'text-background', 'text-foreground', 'text-primary', 'text-secondary',
  'text-accent', 'text-muted', 'text-muted-foreground', 'text-destructive',
  'text-secondary-text',
  'border-background', 'border-foreground', 'border-primary',
  'border-secondary', 'border-accent', 'border-muted', 'border-border',
  'ring-primary', 'ring-secondary', 'ring-accent', 'ring-destructive',
];

/** 标准 Tailwind 颜色 */
const STANDARD_COLORS =
  /^(bg|text|border|ring|from|to|via)-(red|blue|green|yellow|purple|pink|orange|gray|grey|slate|zinc|neutral|stone|amber|lime|emerald|teal|cyan|sky|indigo|violet|fuchsia|rose|white|black|transparent|current|inherit)-?\d*$/;

export class ThemeInspector {
  async inspect(files: string[]): Promise<InspectionResult> {
    const startTime = Date.now();
    const violations: Violation[] = [];

    for (const file of files) {
      if (!file.endsWith('.tsx') && !file.endsWith('.jsx') && !file.endsWith('.css')) continue;
      if (!fs.existsSync(file)) continue;

      const content = fs.readFileSync(file, 'utf-8');
      violations.push(...this.checkTailwindClasses(file, content));
      violations.push(...this.checkHardcodedColors(file, content));
    }

    return {
      passed: violations.filter((v) => v.severity === 'critical').length === 0,
      violations,
      stats: buildStats(files.length, violations),
      inspector: INSPECTOR_ID,
      duration: Date.now() - startTime,
    };
  }

  /** 验证 className 中的 Tailwind 类是否合法 */
  private checkTailwindClasses(file: string, content: string): Violation[] {
    const violations: Violation[] = [];
    const classNameRegex = /className\s*=\s*{?["'`]([^"'`]+)["'`]?}?/g;
    let match: RegExpExecArray | null;

    while ((match = classNameRegex.exec(content)) !== null) {
      const classes = match[1]!.split(/\s+/);
      for (const cls of classes) {
        if (!cls) continue;
        const isToken = VALID_TOKEN_PREFIXES.some((p) => cls.startsWith(p));
        const isStandard = STANDARD_COLORS.test(cls);
        const isArbitrary = /\[.+\]/.test(cls);
        const isNonColor = !cls.startsWith('bg-') && !cls.startsWith('text-') && !cls.startsWith('border-') && !cls.startsWith('ring-');

        if (!isToken && !isStandard && !isArbitrary && !isNonColor) {
          violations.push({
            rule: 'valid-tailwind-class',
            severity: 'low',
            message: `Possibly invalid Tailwind class: "${cls}"`,
            file,
            line: content.substring(0, match.index).split('\n').length,
            suggestion: 'Use a design token from @theme or a standard Tailwind class',
          });
        }
      }
    }

    return violations;
  }

  /** 检测组件中硬编码的颜色值 */
  private checkHardcodedColors(file: string, content: string): Violation[] {
    const violations: Violation[] = [];
    if (file.endsWith('.css')) return violations;

    // 匹配 #xxx 或 #xxxxxx 颜色（排除注释和字符串注释场景）
    const colorRegex = /['"`]#([0-9a-fA-F]{3,8})['"`]/g;
    let match: RegExpExecArray | null;

    while ((match = colorRegex.exec(content)) !== null) {
      const color = match[1]!;
      // 跳过常见的非颜色值
      if (['000', 'fff', 'FFF'].includes(color)) continue;

      violations.push({
        rule: 'no-hardcoded-color',
        severity: 'medium',
        message: `Hardcoded color #${color} — use a design token instead`,
        file,
        line: content.substring(0, match.index).split('\n').length,
        suggestion: 'Define the color in @theme and use the corresponding utility class',
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
