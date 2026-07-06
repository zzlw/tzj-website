#!/usr/bin/env node
/**
 * dev.mjs — Monorepo 开发启动编排
 *
 * 策略：先启动 API（NestJS），等待端口就绪，再启动 web + admin（Next.js）。
 * 避免 Next.js SSR 在 API 未就绪时触发 ECONNREFUSED。
 *
 * 用法：node scripts/dev.mjs
 */

import { spawn } from "node:child_process";
import net from "node:net";

const API_PORT = process.env.API_PORT || "4000";
const POLL_INTERVAL_MS = 200;
const TIMEOUT_MS = 30_000;

/** 等待 TCP 端口可连接 */
function waitForPort(port, timeout) {
  const deadline = Date.now() + timeout;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const sock = net.connect(Number(port), "127.0.0.1");
      sock.once("connect", () => {
        sock.destroy();
        resolve();
      });
      sock.once("error", () => {
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
    stdio: "inherit",
    shell: false,
    ...opts,
  });
}

// ── 主流程 ────────────────────────────────────────────────

console.log("⏳ 正在启动 API 服务...");
const apiProc = run("pnpm", ["--filter", "@tzj/api", "dev"]);

// 捕获退出信号，确保子进程一并终止
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    apiProc.kill(sig);
    process.exit();
  });
}

apiProc.on("exit", (code) => {
  if (code !== 0 && code !== null) {
    console.error(`❌ API 进程异常退出 (code: ${code})`);
    process.exit(code);
  }
});

await waitForPort(API_PORT, TIMEOUT_MS);
console.log(`✅ API 端口 ${API_PORT} 已就绪，启动 web + admin...`);

const turboProc = run("pnpm", [
  "turbo",
  "run",
  "dev",
  "--filter=@tzj/web",
  "--filter=@tzj/admin",
]);

turboProc.on("exit", (code) => process.exit(code ?? 0));
