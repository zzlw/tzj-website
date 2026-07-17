#!/usr/bin/env node
/**
 * dev.mjs — Monorepo 开发启动编排
 *
 * 策略：
 *   1. 启动前清理 API 端口上的残留进程（防止 EADDRINUSE 导致新代码无法生效）
 *   2. 先启动 API（NestJS），等待端口就绪
 *   3. 再启动 web + admin（Next.js）
 *   4. 统一进程组管理，Ctrl+C 时一并终止
 *
 * 用法：node scripts/dev.mjs
 */

import { execSync, spawn } from 'node:child_process';
import net from 'node:net';

const API_PORT = process.env.API_PORT || '4000';
const POLL_INTERVAL_MS = 200;
const TIMEOUT_MS = 60_000;

/** 清理占用指定端口的残留进程（防止旧代码继续运行） */
function killPortOccupants(port) {
  try {
    // macOS / Linux: 用 lsof 找出占用端口的 PID
    const output = execSync(`lsof -ti:${port} 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    if (output) {
      const pids = output.split('\n').filter(Boolean);
      console.log(`🧹 清理端口 ${port} 上的残留进程: ${pids.join(', ')}`);
      execSync(`kill -9 ${pids.join(' ')}`, { timeout: 5000 });
      // 等待进程真正退出
      execSync('sleep 1');
    }
  } catch {
    // lsof 或 kill 失败（无进程占用时 lsof 返回非零退出码），忽略即可
  }
}

/** 等待 TCP 端口可连接 */
function waitForPort(port, timeout) {
  const deadline = Date.now() + timeout;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const sock = net.connect(Number(port), '127.0.0.1');
      sock.once('connect', () => {
        sock.destroy();
        resolve();
      });
      sock.once('error', () => {
        sock.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`等待 API 端口 ${port} 超时（${timeout / 1000}s）`));
        } else {
          setTimeout(tick, POLL_INTERVAL_MS);
        }
      });
    };
    tick();
  });
}

/** 启动子进程，继承 stdio */
function run(cmd, args, opts = {}) {
  return spawn(cmd, args, {
    stdio: 'inherit',
    shell: false,
    ...opts,
  });
}

// ── 主流程 ────────────────────────────────────────────────

// Step 0: 清理端口残留进程（这是「跑旧代码」的根因）
killPortOccupants(API_PORT);

console.log('⏳ 正在启动 API 服务...');
const apiProc = run('pnpm', ['--filter', '@tzj/api', 'dev']);

// 子进程 PID 集合，用于统一清理
const children = [apiProc];

// 捕获退出信号，确保子进程一并终止
let exiting = false;
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (exiting) return;
    exiting = true;
    console.log('\n🛑 正在关闭所有服务...');
    for (const child of children) {
      if (!child.killed) child.kill(sig);
    }
    // 给子进程 3 秒优雅退出，然后强制退出
    setTimeout(() => process.exit(), 3000);
  });
}

apiProc.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`❌ API 进程异常退出 (code: ${code})`);
    for (const child of children) {
      if (!child.killed) child.kill('SIGTERM');
    }
    process.exit(code);
  }
});

await waitForPort(API_PORT, TIMEOUT_MS);
console.log(`✅ API 端口 ${API_PORT} 已就绪，启动 web + admin...`);

const turboProc = run('pnpm', ['turbo', 'run', 'dev', '--filter=@tzj/web', '--filter=@tzj/admin']);
children.push(turboProc);

turboProc.on('exit', (code) => process.exit(code ?? 0));
