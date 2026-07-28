#!/usr/bin/env node
/**
 * 逃逸色检查（C1 护栏）— admin-ui-polish-plan C1.2
 *
 * 后台 UI 颜色一律走语义令牌（success/warning/info/destructive/primary/muted…），
 * 禁止直接使用 Tailwind palette 色阶类。检查范围与 A3 清理范围一致：
 *   apps/admin/src + packages/ui/src（web 官网豁免）
 * 中性灰阶（zinc/slate/neutral/stone/gray 的非类名用法）不在 pattern 内的除外。
 *
 * 用法：node scripts/check-palette-escape.mjs（根 pnpm check 已串联；CI 随之执行）
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SCAN_DIRS = ['apps/admin/src', 'packages/ui/src'];
const EXTENSIONS = new Set(['.ts', '.tsx']);
// A3 清理的九色 + C1 清零的 blue/gray；zinc 等中性灰阶暂豁免（存量属状态圆点中性用法）
const PALETTE_RE =
  /\b(?:emerald|amber|sky|violet|teal|rose|indigo|green|orange|blue|gray)-(?:50|[1-9]00|950)\b/g;

/** @type {{ file: string; line: number; match: string; text: string }[]} */
const violations = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(full);
      continue;
    }
    if (![...EXTENSIONS].some((ext) => entry.name.endsWith(ext))) continue;
    const lines = readFileSync(full, 'utf8').split('\n');
    lines.forEach((text, i) => {
      for (const m of text.matchAll(PALETTE_RE)) {
        violations.push({
          file: relative(ROOT, full),
          line: i + 1,
          match: m[0],
          text: text.trim(),
        });
      }
    });
  }
}

for (const dir of SCAN_DIRS) {
  walk(join(ROOT, dir));
}

if (violations.length > 0) {
  console.error(`✘ 发现 ${violations.length} 处 palette 逃逸色（应使用语义令牌）：\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.match}]  ${v.text.slice(0, 120)}`);
  }
  console.error(
    '\n  修复指引：docs/design/admin-ui-polish-plan.md（A3/C1）与 CONVENTIONS.md 设计令牌章节。',
  );
  process.exit(1);
}

console.log(`✔ palette 逃逸色检查通过（${SCAN_DIRS.join(', ')}）`);
