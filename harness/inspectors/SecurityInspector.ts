/**
 * Security Inspector — 安全检查器
 *
 * 检测危险脚本、XSS 向量、敏感数据泄露、注入风险。
 *
 * @module harness/inspectors/SecurityInspector
 */

import * as fs from 'node:fs';
import type { InspectionResult, Violation } from '../contracts/Inspection';

const INSPECTOR_ID = 'SecurityInspector';

/** 危险模式检测规则 */
const DANGEROUS_PATTERNS: Array<{
  pattern: RegExp;
  rule: string;
  message: string;
  severity: Violation['severity'];
}> = [
  {
    pattern: /\beval\s*\(/g,
    rule: 'no-eval',
    message: 'eval() is a critical security risk — never use dynamic code execution',
    severity: 'critical',
  },
  {
    pattern: /\bnew\s+Function\s*\(/g,
    rule: 'no-function-constructor',
    message: 'new Function() is equivalent to eval()',
    severity: 'critical',
  },
  {
    pattern: /\.innerHTML\s*=/g,
    rule: 'no-innerHTML',
    message: 'Direct innerHTML assignment is an XSS vector',
    severity: 'high',
  },
  {
    pattern: /dangerouslySetInnerHTML/g,
    rule: 'no-dangerouslySetInnerHTML',
    message: 'dangerouslySetInnerHTML bypasses React XSS protection — use DOMPurify',
    severity: 'high',
  },
  {
    pattern: /document\.write\s*\(/g,
    rule: 'no-document-write',
    message: 'document.write() is deprecated and blocks rendering',
    severity: 'medium',
  },
];

/** 敏感数据模式 */
const SENSITIVE_PATTERNS: Array<{
  pattern: RegExp;
  rule: string;
  message: string;
}> = [
  { pattern: /password\s*[:=]\s*["'][^"']+["']/gi, rule: 'no-hardcoded-password', message: 'Hardcoded password detected' },
  { pattern: /secret\s*[:=]\s*["'][^"']+["']/gi, rule: 'no-hardcoded-secret', message: 'Hardcoded secret detected' },
  { pattern: /api[_-]?key\s*[:=]\s*["'][^"']+["']/gi, rule: 'no-hardcoded-api-key', message: 'Hardcoded API key detected' },
  { pattern: /private[_-]?key\s*[:=]\s*["'][^"']+["']/gi, rule: 'no-hardcoded-private-key', message: 'Hardcoded private key detected' },
];

export class SecurityInspector {
  async inspect(files: string[]): Promise<InspectionResult> {
    const startTime = Date.now();
    const violations: Violation[] = [];

    for (const file of files) {
      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, 'utf-8');
      const isTest = file.includes('.test.') || file.includes('.spec.');

      violations.push(...this.checkDangerousPatterns(file, content));
      if (!isTest) {
        violations.push(...this.checkSensitiveData(file, content));
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

  private checkDangerousPatterns(file: string, content: string): Violation[] {
    const violations: Violation[] = [];

    for (const { pattern, rule, message, severity } of DANGEROUS_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(content)) !== null) {
        // 跳过注释中的匹配
        const lineStart = content.lastIndexOf('\n', match.index) + 1;
        const linePrefix = content.substring(lineStart, match.index);
        if (linePrefix.includes('//') || linePrefix.includes('*')) continue;

        violations.push({
          rule,
          severity,
          message,
          file,
          line: content.substring(0, match.index).split('\n').length,
        });
      }
    }

    return violations;
  }

  private checkSensitiveData(file: string, content: string): Violation[] {
    const violations: Violation[] = [];

    // 跳过 .env.example 和环境配置文件
    if (file.includes('.env.example') || file.includes('.env.template')) return violations;

    for (const { pattern, rule, message } of SENSITIVE_PATTERNS) {
      if (pattern.test(content)) {
        violations.push({
          rule,
          severity: 'critical',
          message,
          file,
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
