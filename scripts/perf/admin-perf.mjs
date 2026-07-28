#!/usr/bin/env node
/**
 * Admin 性能度量（C2）— admin-ui-polish-plan C2
 *
 * 两项指标（验收表「导航反馈」「流式渲染」）：
 *   1. 导航反馈：侧栏点击 → 首个视觉反馈（NextTopLoader #nprogress 出现），参考阈值 < 100ms
 *   2. 仪表盘首块：整页导航 → 欢迎行 <h1> 可见（流式首个 flush），参考阈值 < 500ms
 *
 * 阈值仅本地参考，默认只记录不失败（CI 不卡卡口）；设 PERF_ENFORCE=1 时超标 exit 1。
 * 复用 apps/admin 的 playwright 依赖，不新增工具链。
 *
 * 用法：
 *   PERF_USERNAME=xxx PERF_PASSWORD=xxx node scripts/perf/admin-perf.mjs
 *   可选：PERF_BASE_URL（默认 http://localhost:3002）、PERF_ROUNDS（默认 5）
 */
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../apps/admin/package.json', import.meta.url));
const { chromium } = require('playwright');

const BASE_URL = process.env.PERF_BASE_URL ?? 'http://localhost:3002';
const USERNAME = process.env.PERF_USERNAME;
const PASSWORD = process.env.PERF_PASSWORD;
const ROUNDS = Number(process.env.PERF_ROUNDS ?? 5);
const ENFORCE = process.env.PERF_ENFORCE === '1';

const NAV_FEEDBACK_BUDGET_MS = 100;
const FIRST_BLOCK_BUDGET_MS = 500;
/** 导航反馈度量的目标路由（侧栏一级入口，覆盖轻重两类页面） */
const NAV_TARGETS = ['/contacts', '/users'];

if (!USERNAME || !PASSWORD) {
  console.error('缺少凭据：请通过 PERF_USERNAME / PERF_PASSWORD 环境变量传入（勿写入仓库）');
  process.exit(2);
}

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const fmt = (arr) =>
  `median ${median(arr).toFixed(1)}ms  max ${Math.max(...arr).toFixed(1)}ms  (${arr.map((v) => v.toFixed(0)).join(' / ')})`;

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#username', USERNAME);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
}

/** 指标 1：客户端导航点击 → #nprogress 出现（同一 JS 上下文内计时，无协议往返误差） */
async function measureNavFeedback(page, href) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  const delta = await page.evaluate(
    ({ target }) =>
      new Promise((resolve) => {
        const link = document.querySelector(`a[href="${target}"]`);
        if (!link) {
          resolve(-1);
          return;
        }
        let clickAt = 0;
        const mo = new MutationObserver(() => {
          if (document.getElementById('nprogress')) {
            mo.disconnect();
            resolve(performance.now() - clickAt);
          }
        });
        mo.observe(document.body, { childList: true, subtree: true });
        clickAt = performance.now();
        link.click();
        setTimeout(() => {
          mo.disconnect();
          resolve(-1);
        }, 5000);
      }),
    { target: href },
  );
  if (delta < 0) throw new Error(`导航反馈度量失败：${href}（侧栏链接缺失或 5s 内无进度条）`);
  await page.waitForURL(`${BASE_URL}${href}`, { timeout: 15000 });
  return delta;
}

/** 指标 2：整页导航 → 欢迎行 <h1> 首次出现（performance.now() 以导航开始为原点） */
async function measureFirstBlock(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'commit' });
  // 在 raf 轮询帧内直接取时，避免额外 evaluate 往返虚增耗时（误差 ≤ 1 帧）
  const handle = await page.waitForFunction(
    () => (document.querySelector('h1') ? performance.now() : null),
    { timeout: 15000 },
  );
  return handle.jsonValue();
}

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await login(page);
  console.log(`✔ 登录成功（${BASE_URL}）\n`);

  // 预热一轮，排除冷编译/空缓存噪声（dev 模式下首访包含按需编译）
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  for (const href of NAV_TARGETS) {
    await page.goto(`${BASE_URL}${href}`, { waitUntil: 'networkidle' });
  }

  const failures = [];

  for (const href of NAV_TARGETS) {
    const samples = [];
    for (let i = 0; i < ROUNDS; i++) samples.push(await measureNavFeedback(page, href));
    const med = median(samples);
    const pass = med < NAV_FEEDBACK_BUDGET_MS;
    console.log(
      `${pass ? '✔' : '✘'} 导航反馈 ${href}（预算 ${NAV_FEEDBACK_BUDGET_MS}ms）: ${fmt(samples)}`,
    );
    if (!pass) failures.push(`导航反馈 ${href}: ${med.toFixed(1)}ms`);
  }

  {
    const samples = [];
    for (let i = 0; i < ROUNDS; i++) samples.push(await measureFirstBlock(page));
    const med = median(samples);
    const pass = med < FIRST_BLOCK_BUDGET_MS;
    console.log(
      `${pass ? '✔' : '✘'} 仪表盘首块可见（预算 ${FIRST_BLOCK_BUDGET_MS}ms）: ${fmt(samples)}`,
    );
    if (!pass) failures.push(`仪表盘首块: ${med.toFixed(1)}ms`);
  }

  await browser.close();

  if (failures.length > 0) {
    console.log(`\n${failures.length} 项超出参考预算（阈值仅参考，CI 不卡口）`);
    if (ENFORCE) process.exit(1);
  } else {
    console.log('\n✔ 全部指标在参考预算内');
  }
};

run().catch((err) => {
  console.error('度量执行失败：', err.message);
  process.exit(2);
});
