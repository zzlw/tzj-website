/**
 * Component Inspector — 组件检查器
 *
 * 检查 React 组件规范：命名、Shadcn 复用、DOM 深度、JSX 完整性。
 *
 * @module harness/inspectors/ComponentInspector
 */

import * as fs from 'node:fs';
import type { InspectionResult, Violation } from '../contracts/Inspection';

const INSPECTOR_ID = 'ComponentInspector';

const SHADCN_COMPONENTS = new Set([
  'Button', 'Card', 'Badge', 'Dialog', 'Table', 'DataTable',
  'Input', 'Label', 'Tabs', 'Sheet', 'Alert', 'Tooltip',
  'Form', 'Select', 'Textarea', 'Checkbox', 'RadioGroup', 'Switch',
  'Slider', 'Avatar', 'DropdownMenu', 'Popover', 'ScrollArea',
  'Separator', 'Skeleton', 'Toast',
]);

const MAX_DOM_DEPTH = 5;

export class ComponentInspector {
  async inspect(files: string[]): Promise<InspectionResult> {
    const startTime = Date.now();
    const violations: Violation[] = [];

    for (const file of files) {
      if (!file.endsWith('.tsx') && !file.endsWith('.jsx')) continue;
      if (!fs.existsSync(file)) continue;

      const content = fs.readFileSync(file, 'utf-8');

      violations.push(...this.checkDuplicateShadcn(file, content));
      violations.push(...this.checkDomDepth(file, content));
      violations.push(...this.checkComponentNaming(file, content));
      violations.push(...this.checkJsxKey(file, content));
    }

    return {
      passed: violations.filter((v) => v.severity === 'critical').length === 0,
      violations,
      stats: buildStats(files.length, violations),
      inspector: INSPECTOR_ID,
      duration: Date.now() - startTime,
    };
  }

  /** 禁止重复实现 Shadcn 已有组件 */
  private checkDuplicateShadcn(file: string, content: string): Violation[] {
    const violations: Violation[] = [];
    if (file.includes('packages/ui/src')) return violations;

    for (const comp of SHADCN_COMPONENTS) {
      const regex = new RegExp(`(?:export\\s+(?:const|function)\\s+${comp}\\b)`);
      if (regex.test(content)) {
        violations.push({
          rule: 'no-duplicate-shadcn',
          severity: 'high',
          message: `Component "${comp}" duplicates a Shadcn/ui component — import from @tzj/ui instead`,
          file,
          suggestion: `import { ${comp} } from "@tzj/ui";`,
        });
      }
    }

    return violations;
  }

  /** DOM 嵌套不超过 MAX_DOM_DEPTH 层 */
  private checkDomDepth(file: string, content: string): Violation[] {
    const violations: Violation[] = [];
    const lines = content.split('\n');
    let depth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const openTags = (line.match(/<[a-z][a-zA-Z0-9]*[\s/>]/g) ?? []).length;
      const closeTags = (line.match(/<\/[a-z][a-zA-Z0-9]*>/g) ?? []).length;
      const selfClosing = (line.match(/\/>/g) ?? []).length;

      depth += openTags - closeTags - selfClosing;

      if (depth > MAX_DOM_DEPTH) {
        violations.push({
          rule: 'max-dom-depth',
          severity: 'medium',
          message: `DOM nesting (${depth}) exceeds max (${MAX_DOM_DEPTH}) — extract sub-components`,
          file,
          line: i + 1,
        });
        break;
      }
    }

    return violations;
  }

  /** 组件命名 PascalCase */
  private checkComponentNaming(file: string, content: string): Violation[] {
    const violations: Violation[] = [];
    const regex = /export\s+(?:default\s+)?(?:const|function)\s+([a-z][a-zA-Z0-9]*)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      const name = match[1]!;
      if (/^[a-z]/.test(name) && /[A-Z]/.test(name.slice(1))) {
        violations.push({
          rule: 'component-naming',
          severity: 'medium',
          message: `Component "${name}" should use PascalCase`,
          file,
          line: content.substring(0, match.index).split('\n').length,
          suggestion: `Rename to "${name.charAt(0).toUpperCase() + name.slice(1)}"`,
        });
      }
    }

    return violations;
  }

  /** .map() 必须有 key */
  private checkJsxKey(file: string, content: string): Violation[] {
    const violations: Violation[] = [];
    const mapRegex = /\.map\s*\(\s*\(?[^)]*\)?\s*=>\s*<?[A-Za-z]/g;
    let match: RegExpExecArray | null;

    while ((match = mapRegex.exec(content)) !== null) {
      const afterMap = content.substring(match.index, match.index + 300);
      if (!/key\s*=\s*[{]/.test(afterMap)) {
        violations.push({
          rule: 'jsx-key-required',
          severity: 'high',
          message: 'List items from .map() must have a unique key prop',
          file,
          line: content.substring(0, match.index).split('\n').length,
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
