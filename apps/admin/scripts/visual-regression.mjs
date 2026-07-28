#!/usr/bin/env node
/**
 * B1 视觉回归脚本（admin-ui-polish-plan.md Phase B1.5）
 *
 * 用法：
 *   node scripts/visual-regression.mjs capture baseline   # 迁移前落基线
 *   node scripts/visual-regression.mjs capture current    # 迁移后抓当前
 *   node scripts/visual-regression.mjs compare            # 基线 vs 当前逐页像素对比
 *
 * 前置：本地 admin(3002) 已启动；登录凭证从环境变量读取：
 *   ADMIN_E2E_USERNAME / ADMIN_E2E_PASSWORD（或回退 SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD）
 *
 * 产物目录 .visual-regression/（已 gitignore）：baseline/ current/ diff/
 * 对比实现：Chromium 内 canvas 逐像素比对（单通道差 >15 记为不同），不引入新依赖。
 * 注意：时间戳/运行时长/图表动画会产生少量噪声，diff% < 0.5 视为通过，超出人工核对 diff 图。
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.visual-regression');
const BASE_URL = process.env.ADMIN_BASE_URL || 'http://localhost:3002';
const VIEWPORT = { width: 1440, height: 900 };
const DIFF_PASS_PCT = 0.5;

/** 核心页面清单：覆盖全部 19 个 Radix 组件的消费场景（列表/表单/详情/分析/会话）。 */
const PAGES = [
  ['dashboard', '/'],
  ['contacts', '/contacts'],
  ['customers', '/customers'],
  ['customers-new', '/customers/new'],
  ['blog', '/blog'],
  ['blog-new', '/blog/new'],
  ['cases', '/cases'],
  ['news', '/news'],
  ['trade-shows', '/trade-shows'],
  ['media', '/media'],
  ['documents-mine', '/documents/mine'],
  ['users', '/users'],
  ['users-new', '/users/new'],
  ['visitors', '/visitors'],
  ['analytics', '/analytics'],
  ['audit-logs', '/audit-logs'],
  ['security', '/security'],
  ['settings-site', '/settings/site'],
  ['settings-account', '/settings/account'],
  ['settings-integrations', '/settings/integrations'],
  ['settings-chat', '/settings/chat'],
  ['system-status', '/system/status'],
  ['legal-pages', '/legal-pages'],
  ['access', '/access'],
  ['chat', '/chat'],
];

/** 冻结动画/过渡/闪烁光标，降低截图噪声。 */
const FREEZE_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
`;

function credentials() {
  const username = process.env.ADMIN_E2E_USERNAME || process.env.SEED_ADMIN_USERNAME;
  const password = process.env.ADMIN_E2E_PASSWORD || process.env.SEED_ADMIN_PASSWORD;
  if (!username || !password) {
    console.error('缺少登录凭证：请设置 ADMIN_E2E_USERNAME / ADMIN_E2E_PASSWORD 环境变量');
    process.exit(1);
  }
  return { username, password };
}

async function login(context) {
  const res = await context.request.post(`${BASE_URL}/api/auth/login`, {
    data: credentials(),
  });
  if (!res.ok()) {
    console.error(`登录失败：HTTP ${res.status()} ${await res.text()}`);
    process.exit(1);
  }
  // context.request 与 context 共享 cookie jar，无需手动搬运
}

async function capture(tag) {
  const dir = path.join(OUT, tag);
  await mkdir(dir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    reducedMotion: 'reduce',
  });
  await login(context);
  const page = await context.newPage();
  await page.addInitScript((css) => {
    const inject = () => {
      const style = document.createElement('style');
      style.textContent = css;
      document.documentElement.appendChild(style);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inject);
    } else {
      inject();
    }
  }, FREEZE_CSS);

  for (const [name, route] of PAGES) {
    const file = path.join(dir, `${name}.png`);
    try {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 30_000 });
      await page.waitForTimeout(800); // 图表/流式区块二次渲染余量
      await page.screenshot({ path: file, fullPage: true });
      console.log(`✓ ${name}  (${route})`);
    } catch (err) {
      console.error(`✗ ${name}  (${route})  ${err.message.split('\n')[0]}`);
    }
  }
  await browser.close();
  console.log(`\n截图输出：${dir}`);
}

/** 在 Chromium 页面内用 canvas 对比两张 PNG，返回差异统计与 diff 图 dataURL。 */
async function diffInPage(page, aBuf, bBuf) {
  return page.evaluate(
    async ([aB64, bB64]) => {
      const load = (b64) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = `data:image/png;base64,${b64}`;
        });
      const [a, b] = await Promise.all([load(aB64), load(bB64)]);
      if (a.width !== b.width || a.height !== b.height) {
        return { sizeMismatch: true, aSize: [a.width, a.height], bSize: [b.width, b.height] };
      }
      const w = a.width;
      const h = a.height;
      const draw = (img) => {
        const c = new OffscreenCanvas(w, h);
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, w, h).data;
      };
      const da = draw(a);
      const db = draw(b);
      const diffCanvas = new OffscreenCanvas(w, h);
      const dctx = diffCanvas.getContext('2d');
      dctx.drawImage(a, 0, 0);
      dctx.globalAlpha = 0.85;
      dctx.fillStyle = '#fff';
      dctx.fillRect(0, 0, w, h);
      dctx.globalAlpha = 1;
      const out = dctx.getImageData(0, 0, w, h);
      let diff = 0;
      for (let i = 0; i < da.length; i += 4) {
        const delta =
          Math.abs(da[i] - db[i]) +
          Math.abs(da[i + 1] - db[i + 1]) +
          Math.abs(da[i + 2] - db[i + 2]);
        if (delta > 45) {
          diff++;
          out.data[i] = 255;
          out.data[i + 1] = 0;
          out.data[i + 2] = 0;
          out.data[i + 3] = 255;
        }
      }
      dctx.putImageData(out, 0, 0);
      const blob = await diffCanvas.convertToBlob({ type: 'image/png' });
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      return { sizeMismatch: false, total: w * h, diff, dataUrl };
    },
    [aBuf.toString('base64'), bBuf.toString('base64')],
  );
}

async function compare() {
  const baseDir = path.join(OUT, 'baseline');
  const currDir = path.join(OUT, 'current');
  const diffDir = path.join(OUT, 'diff');
  await mkdir(diffDir, { recursive: true });
  const names = (await readdir(baseDir)).filter((f) => f.endsWith('.png'));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const rows = [];
  let failed = 0;

  for (const file of names) {
    const name = file.replace(/\.png$/, '');
    let curr;
    try {
      curr = await readFile(path.join(currDir, file));
    } catch {
      rows.push([name, 'MISSING', '当前截图缺失']);
      failed++;
      continue;
    }
    const base = await readFile(path.join(baseDir, file));
    const r = await diffInPage(page, base, curr);
    if (r.sizeMismatch) {
      rows.push([name, 'SIZE', `${r.aSize.join('x')} → ${r.bSize.join('x')}`]);
      failed++;
      continue;
    }
    const pct = (r.diff / r.total) * 100;
    const pass = pct < DIFF_PASS_PCT;
    if (!pass) {
      failed++;
      const b64 = r.dataUrl.split(',')[1];
      await writeFile(path.join(diffDir, file), Buffer.from(b64, 'base64'));
    }
    rows.push([name, pass ? 'PASS' : 'DIFF', `${pct.toFixed(3)}%`]);
  }
  await browser.close();

  const width = Math.max(...rows.map(([n]) => n.length)) + 2;
  console.log(`\n${'页面'.padEnd(width)}结果   差异`);
  for (const [name, status, detail] of rows) {
    console.log(`${name.padEnd(width)}${status.padEnd(7)}${detail}`);
  }
  console.log(
    `\n${rows.length} 页，${failed} 页超阈值（>${DIFF_PASS_PCT}%），diff 图见 ${diffDir}`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

const [mode, tag] = process.argv.slice(2);
if (mode === 'capture' && (tag === 'baseline' || tag === 'current')) {
  await capture(tag);
} else if (mode === 'compare') {
  await compare();
} else {
  console.log('用法：node scripts/visual-regression.mjs capture <baseline|current> | compare');
  process.exit(1);
}
