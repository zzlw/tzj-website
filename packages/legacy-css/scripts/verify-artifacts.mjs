/**
 * CI 产物断言：
 *   - legacy CSS 无 v4 专属语法（@layer / @property / oklch( / oklab(；注释先剥离）
 *   - 无 @tailwind / @import / @source 残留
 *   - color-mix 显式 allowlist（当前仅滚动条 thumb 2 处）
 *   - generated/legacy-css.ts 的 href 与 public/legacy 实际文件一致
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');
const repoRoot = path.resolve(pkgRoot, '../..');
const legacyDir = path.join(repoRoot, 'apps/web/public/legacy');
const generatedTs = path.join(repoRoot, 'apps/web/src/generated/legacy-css.ts');

const errors = [];

const cssFiles = fs.readdirSync(legacyDir).filter((file) => /^legacy\.[0-9a-f]+\.css$/.test(file));
if (cssFiles.length === 0) {
  console.error('[verify] 未找到 legacy CSS 产物，请先运行 pnpm --filter @tzj/legacy-css build');
  process.exit(1);
}

for (const file of cssFiles) {
  const raw = fs.readFileSync(path.join(legacyDir, file), 'utf8');
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const banned of [
    '@layer',
    '@property',
    'oklch(',
    'oklab(',
    '@tailwind',
    '@import',
    '@source',
  ]) {
    if (css.includes(banned)) errors.push(`${file}: 禁止语法 ${banned}`);
  }
  const colorMixCount = (css.match(/color-mix\(/g) ?? []).length;
  if (colorMixCount > 2) {
    errors.push(`${file}: color-mix 出现 ${colorMixCount} 处（allowlist 上限 2）`);
  }
}

if (!fs.existsSync(generatedTs)) {
  errors.push('缺少 apps/web/src/generated/legacy-css.ts');
} else {
  const ts = fs.readFileSync(generatedTs, 'utf8');
  const hrefs = [...ts.matchAll(/'(\/legacy\/[^']+)'/g)].map((match) => match[1]);
  const actualFiles = new Set(fs.readdirSync(legacyDir));
  for (const href of hrefs) {
    if (!actualFiles.has(path.basename(href))) {
      errors.push(`generated href 指向不存在的产物：${href}`);
    }
  }
  if (hrefs.length !== 2) {
    errors.push(`generated 应包含 2 个 href，实际 ${hrefs.length} 个`);
  }
}

if (errors.length > 0) {
  console.error('[verify] 产物断言失败：');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`[verify] OK：${cssFiles.length} 个 legacy CSS 产物通过断言`);
