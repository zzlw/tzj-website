import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, 'public', 'vditor-assets', 'dist');

// 用模块解析定位 vditor dist：pnpm shamefully-hoist 下 vditor 被提升到仓库根
// node_modules，而 Docker builder 仅复制根 node_modules（不含 apps/*/node_modules），
// 写死 app 级路径会导致 existsSync 落空而静默 skip → 生产缺 vditor-assets（404）。
const require = createRequire(import.meta.url);
let src;
try {
  src = join(dirname(require.resolve('vditor/package.json')), 'dist');
} catch {
  console.warn('[copy-vditor-assets] vditor not installed, skip');
  process.exit(0);
}

if (!existsSync(src)) {
  console.warn('[copy-vditor-assets] vditor dist not found, skip');
  process.exit(0);
}

mkdirSync(join(root, 'public', 'vditor-assets'), { recursive: true });
cpSync(src, dest, { recursive: true });
console.log('[copy-vditor-assets] synced vditor dist -> public/vditor-assets/dist');
