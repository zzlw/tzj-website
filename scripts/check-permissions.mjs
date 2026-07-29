// 权限注解静态审计（CI 门禁）：扫描 apps/api 全部 Controller 端点，
// 确保每个端点都显式声明保护状态之一：
//   - @RequirePermissions / @Roles（类级或方法级）→ GUARDED
//   - @Public()                                  → PUBLIC（有意公开，需 review）
//   - @AuthenticatedOnly() / @AllowUnenrolled()  → 仅登录（自我服务类端点）
// 任何「裸端点」（无上述注解）都会被 RolesGuard 的 fail-closed 兜底直接 403，
// 属于漏标注 → 本脚本 exit 1 阻断 CI。
// 见 docs/b2b-permission-system-assessment.md 第三章 P1。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'apps/api/src';
const METHOD_RE = /@(Get|Post|Put|Patch|Delete|Sse)\(([^)]*)\)/;
const GUARDS = ['RequirePermissions', 'Roles', 'Public', 'AllowUnenrolled', 'AuthenticatedOnly'];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.controller.ts')) out.push(p);
  }
  return out;
}

const rows = [];
for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  // 类级装饰器：export class 之前的所有装饰器行
  const classIdx = lines.findIndex((l) => /export class /.test(l));
  const classDecos = new Set();
  for (let i = 0; i < classIdx; i++) {
    for (const g of GUARDS) if (lines[i].includes(`@${g}(`)) classDecos.add(g);
  }
  const ctrlMatch = src.match(/@Controller\(['"`]([^'"`]*)['"`]/);
  const base = ctrlMatch ? ctrlMatch[1] : '?';

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(METHOD_RE);
    if (!m) continue;
    const methodDecos = new Set();
    // 向上收集同一装饰器块（容许注释与紧邻空行）
    for (let j = i - 1; j >= 0; j--) {
      const l = lines[j].trim();
      if (
        l.startsWith('@') ||
        l.startsWith('//') ||
        l.startsWith('*') ||
        l.startsWith('/*') ||
        l === ''
      ) {
        for (const g of GUARDS) if (l.includes(`@${g}(`)) methodDecos.add(g);
        if (l === '' && j < i - 1) break;
        continue;
      }
      break;
    }
    // 向下收集（HTTP 方法装饰器之后还可能有其他装饰器）
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j].trim();
      if (l.startsWith('@')) {
        for (const g of GUARDS) if (l.includes(`@${g}(`)) methodDecos.add(g);
        continue;
      }
      break;
    }
    const subPath = (m[2].match(/['"`]([^'"`]*)['"`]/) || [])[1] ?? '';
    const all = new Set([...classDecos, ...methodDecos]);
    let status;
    if (methodDecos.has('Public') || (classDecos.has('Public') && methodDecos.size === 0)) {
      status = 'PUBLIC';
    } else if (all.has('RequirePermissions') || all.has('Roles')) {
      status = 'GUARDED';
    } else if (methodDecos.has('AllowUnenrolled')) {
      status = 'AUTH_ONLY(AllowUnenrolled)';
    } else if (methodDecos.has('AuthenticatedOnly')) {
      status = 'AUTH_ONLY(AuthenticatedOnly)';
    } else {
      status = 'BARE';
    }
    rows.push({
      file: file.replace(`${ROOT}/`, ''),
      ep: `${m[1].toUpperCase()} /${base}${subPath ? `/${subPath}` : ''}`,
      status,
    });
  }
}

const byStatus = {};
for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
console.log(`扫描 ${rows.length} 个端点：${JSON.stringify(byStatus)}`);

const bare = rows.filter((r) => r.status === 'BARE');
if (bare.length > 0) {
  console.error('\n❌ 发现未标注保护状态的端点（将被 RolesGuard fail-closed 直接 403）：');
  for (const r of bare) console.error(`   ${r.ep}  (${r.file})`);
  console.error(
    '\n请为上述端点添加 @RequirePermissions()/@Roles()，或显式声明 @AuthenticatedOnly()/@Public()。',
  );
  process.exit(1);
}
console.log('✅ 全部端点均已显式声明保护状态');
